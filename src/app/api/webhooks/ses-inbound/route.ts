/**
 * AWS SES inbound email webhook (via SNS).
 *
 * Setup côté AWS (à faire une fois, en us-east-1 / us-west-2 / eu-west-1
 * car SES inbound n'est PAS dispo en eu-west-3) :
 *   1. SES → Email receiving → Rule set → nouvelle rule
 *   2. Recipient condition : catch-all sur ton domaine inbound (ex: reply.closrm.fr)
 *   3. Action : "SNS" (pour emails < 150KB) OU "S3 + SNS" (emails plus gros)
 *      - On démarre en mode SNS-only pour simplifier. Attachements ignorés au-dessus de 150KB.
 *   4. SNS topic : créer "closrm-ses-inbound" + subscription HTTPS vers cette URL.
 *   5. MX record : configurer reply.tondomaine.fr → 10 inbound-smtp.<region>.amazonaws.com
 *
 * Matching workspace :
 *   L'adresse "to" est de la forme reply@reply.<custom_domain>.
 *   On retrouve le workspace via email_domains.domain.
 */

import { NextResponse } from 'next/server'
import PostalMime from 'postal-mime'
import { createServiceClient } from '@/lib/supabase/service'
import { isAllowedSnsTopic } from '@/lib/email/sns-verify'

interface SnsEnvelope {
  Type?: string
  Message?: string
  SubscribeURL?: string
  TopicArn?: string
}

interface SesInboundNotification {
  notificationType?: string // "Received"
  mail?: {
    messageId?: string
    source?: string
    destination?: string[]
    commonHeaders?: {
      from?: string[]
      to?: string[]
      subject?: string
      messageId?: string
    }
  }
  content?: string // raw MIME (base64 or plain) quand SNS-only action
}

export async function POST(request: Request) {
  const text = await request.text()
  let envelope: SnsEnvelope
  try {
    envelope = JSON.parse(text) as SnsEnvelope
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Filtrage TopicArn en defense-en-profondeur (voir sns-verify.ts)
  if (!isAllowedSnsTopic(envelope)) {
    console.warn('[ses-inbound] rejected unknown TopicArn', envelope.TopicArn)
    return NextResponse.json({ ok: false, error: 'unknown topic' }, { status: 403 })
  }

  // Handshake SNS
  if (envelope.Type === 'SubscriptionConfirmation' && envelope.SubscribeURL) {
    try {
      await fetch(envelope.SubscribeURL, { method: 'GET' })
    } catch (err) {
      console.error('[ses-inbound] SNS confirmation failed', err)
    }
    return NextResponse.json({ ok: true })
  }

  if (envelope.Type !== 'Notification' || !envelope.Message) {
    return NextResponse.json({ ok: true })
  }

  let notif: SesInboundNotification
  try {
    notif = JSON.parse(envelope.Message) as SesInboundNotification
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (notif.notificationType !== 'Received' || !notif.content) {
    return NextResponse.json({ ok: true })
  }

  const sesMessageId = notif.mail?.messageId
  if (!sesMessageId) return NextResponse.json({ ok: true })

  const supabase = createServiceClient()

  // Idempotence : si déjà ingéré, on sort
  const { data: existing } = await supabase
    .from('email_messages')
    .select('id')
    .eq('ses_message_id', sesMessageId)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, dedup: true })

  // Parse MIME. SES envoie le content en base64 dans le champ SNS si action "SNS".
  let rawMime: string
  try {
    rawMime = Buffer.from(notif.content, 'base64').toString('utf-8')
    // Si le décodage donne du texte qui ressemble pas à du MIME, on assume plain
    if (!rawMime.includes('\n') || !rawMime.toLowerCase().includes('content-type')) {
      rawMime = notif.content
    }
  } catch {
    rawMime = notif.content
  }

  let parsed: Awaited<ReturnType<typeof PostalMime.prototype.parse>>
  try {
    parsed = await new PostalMime().parse(rawMime)
  } catch (err) {
    console.error('[ses-inbound] MIME parse failed', err)
    return NextResponse.json({ ok: true, parseError: true })
  }

  const fromEmail = parsed.from?.address?.toLowerCase() ?? notif.mail?.source?.toLowerCase()
  const fromName = parsed.from?.name ?? null
  const toAddresses = (parsed.to || []).map((t) => t.address?.toLowerCase()).filter(Boolean) as string[]
  const primaryTo = toAddresses[0] || notif.mail?.destination?.[0]?.toLowerCase()
  if (!fromEmail || !primaryTo) return NextResponse.json({ ok: true })

  const subject = parsed.subject || ''
  const messageIdHeader = parsed.messageId || null
  const inReplyTo = parsed.inReplyTo || null
  const referencesHeader = Array.isArray(parsed.references)
    ? parsed.references.join(' ')
    : parsed.references || null
  const bodyText = parsed.text || ''
  const bodyHtml = parsed.html || ''

  // Résolution workspace via email_domains
  // On regarde le domaine du recipient : reply.foo.com → foo.com ou sous-domaine direct
  const toDomain = primaryTo.split('@')[1]
  if (!toDomain) return NextResponse.json({ ok: true })

  const domainCandidates = [toDomain]
  const parts = toDomain.split('.')
  if (parts.length >= 3) {
    domainCandidates.push(parts.slice(1).join('.')) // reply.foo.com → foo.com
  }

  // .limit(1) : si plusieurs domaines matchent (edge case : coach possède
  // foo.com ET reply.foo.com distinctement), prendre le premier plutôt que
  // .maybeSingle() qui renverrait une erreur PGRST116 swallowed.
  const { data: domainRows } = await supabase
    .from('email_domains')
    .select('workspace_id, domain')
    .in('domain', domainCandidates)
    .limit(1)
  const domainRow = domainRows?.[0]

  if (!domainRow) {
    console.warn('[ses-inbound] no matching workspace for', toDomain)
    return NextResponse.json({ ok: true, noWorkspace: true })
  }

  const workspaceId = domainRow.workspace_id

  // Thread matching :
  // 1. inReplyTo → cherche un email_messages.message_id_header qui match → même conversation
  // 2. sinon cherche une conversation par (workspace_id, participant_email) la plus récente avec subject normalisé identique
  // 3. sinon crée une nouvelle conversation
  let conversationId: string | null = null
  let rootMessageId: string | null = null

  if (inReplyTo) {
    const { data: parentMsg } = await supabase
      .from('email_messages')
      .select('conversation_id')
      .eq('workspace_id', workspaceId)
      .eq('message_id_header', inReplyTo)
      .maybeSingle()
    if (parentMsg) conversationId = parentMsg.conversation_id
  }

  if (!conversationId && referencesHeader) {
    const refs = referencesHeader.split(/\s+/).filter(Boolean)
    if (refs.length > 0) {
      const { data: refMsg } = await supabase
        .from('email_messages')
        .select('conversation_id')
        .eq('workspace_id', workspaceId)
        .in('message_id_header', refs)
        .limit(1)
        .maybeSingle()
      if (refMsg) conversationId = refMsg.conversation_id
    }
  }

  // Normalisation du sujet (enlever Re:, Fwd:, etc.)
  const normalizedSubject = subject.replace(/^(re|fwd|fw|tr|aw)\s*:\s*/i, '').trim()
  rootMessageId = inReplyTo || messageIdHeader

  if (!conversationId) {
    // Match par lead: email + workspace + subject normalisé
    const { data: matchingConv } = await supabase
      .from('email_conversations')
      .select('id, root_message_id')
      .eq('workspace_id', workspaceId)
      .eq('participant_email', fromEmail)
      .ilike('subject', normalizedSubject || '%')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (matchingConv) conversationId = matchingConv.id
  }

  // Match lead par email
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', fromEmail)
    .maybeSingle()

  if (!conversationId) {
    const { data: newConv, error: convErr } = await supabase
      .from('email_conversations')
      .insert({
        workspace_id: workspaceId,
        participant_email: fromEmail,
        participant_name: fromName,
        lead_id: lead?.id ?? null,
        subject: normalizedSubject,
        root_message_id: rootMessageId,
        last_message_text: (bodyText || '').slice(0, 500),
        last_message_at: new Date().toISOString(),
        last_message_from: 'participant',
        unread_count: 1,
      })
      .select('id')
      .single()
    if (convErr || !newConv) {
      console.error('[ses-inbound] create conversation failed', convErr)
      return NextResponse.json({ ok: true, error: 'conversation create' })
    }
    conversationId = newConv.id
  } else {
    await supabase
      .from('email_conversations')
      .update({
        last_message_text: (bodyText || '').slice(0, 500),
        last_message_at: new Date().toISOString(),
        last_message_from: 'participant',
        unread_count: (await incrementUnread(supabase, conversationId)) ?? 1,
        lead_id: lead?.id ?? undefined,
      })
      .eq('id', conversationId)
  }

  // Insert message. Si échec (race sur ses_message_id en dedup, FK brisée
  // entre-temps, etc.) on log mais on répond 200 pour éviter que SNS ne
  // redélivre en boucle — le contenu est déjà dans la conversation.
  const { error: msgErr } = await supabase.from('email_messages').insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    ses_message_id: sesMessageId,
    message_id_header: messageIdHeader,
    in_reply_to: inReplyTo,
    references_header: referencesHeader,
    sender_type: 'participant',
    from_email: fromEmail,
    from_name: fromName,
    to_email: primaryTo,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    sent_at: new Date().toISOString(),
    is_read: false,
  })
  if (msgErr && !/duplicate|unique/i.test(msgErr.message)) {
    console.error('[ses-inbound] message insert failed', msgErr)
  }

  return NextResponse.json({ ok: true })
}

async function incrementUnread(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('email_conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .maybeSingle()
  return (data?.unread_count ?? 0) + 1
}
