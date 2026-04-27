import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'
import { sendThreadedEmail } from '@/lib/email/send-raw'
import { consumeResource } from '@/lib/billing/service'
import { logEmailSend } from '@/lib/email/log-send'
import { isSuppressed } from '@/lib/email/client'

export async function GET(request: Request) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''

    let query = supabase
      .from('email_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (search) {
      query = query.or(
        `participant_email.ilike.%${search}%,participant_name.ilike.%${search}%,subject.ilike.%${search}%`,
      )
    }

    const { data, error } = await query.limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/emails/conversations
 *
 * Crée une nouvelle conversation email (ou réutilise l'existante si même
 * participant_email déjà en DB) et envoie le premier message.
 *
 * Body :
 *   - to_email: string (obligatoire)
 *   - subject: string (obligatoire)
 *   - body_text / body_html (au moins un)
 *   - lead_id?: string — si fourni, lie la conversation au lead
 *   - to_name?: string
 */
export async function POST(request: Request) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body invalide' }, { status: 400 })
    }

    const {
      to_email,
      to_name,
      subject,
      body_text,
      body_html,
      lead_id,
    } = body as {
      to_email?: string
      to_name?: string
      subject?: string
      body_text?: string
      body_html?: string
      lead_id?: string
    }

    const recipientEmail = to_email?.trim().toLowerCase()
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: 'Email destinataire invalide' }, { status: 400 })
    }
    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Sujet requis' }, { status: 400 })
    }
    if (!body_html && !body_text) {
      return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })
    }

    // Pre-check suppression : ne pas débiter si l'email est bloqué
    if (await isSuppressed(recipientEmail, workspaceId)) {
      return NextResponse.json(
        { error: 'Cette adresse est sur la suppression list (bounce/complaint/désabonnement)' },
        { status: 400 },
      )
    }

    // Résout le lead si pas fourni, via l'email
    let resolvedLeadId = lead_id ?? null
    let resolvedLeadName = to_name ?? null
    if (!resolvedLeadId) {
      const { data: matchingLead } = await supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('workspace_id', workspaceId)
        .eq('email', recipientEmail)
        .maybeSingle()
      if (matchingLead) {
        resolvedLeadId = matchingLead.id
        resolvedLeadName =
          resolvedLeadName ||
          [matchingLead.first_name, matchingLead.last_name].filter(Boolean).join(' ') ||
          null
      }
    }

    const sender = await getWorkspaceSenderConfig(workspaceId)

    // Quota + débit avant envoi
    const quotaResult = await consumeResource({
      workspaceId,
      resourceType: 'email',
      quantity: 1,
      source: 'direct_message',
      metadata: { to: recipientEmail, new_conversation: true },
    })
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { error: quotaResult.error_message || 'Quota email dépassé' },
        { status: 402 },
      )
    }

    const result = await sendThreadedEmail({
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      replyTo: sender.replyTo,
      workspaceId,
      to: recipientEmail,
      subject: subject.trim(),
      bodyHtml: body_html,
      bodyText: body_text,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Envoi échoué' }, { status: 500 })
    }

    const newMessageIdHeader = result.messageId
      ? `<${result.messageId}@email.amazonses.com>`
      : null

    // Cherche conversation existante sur (workspace_id, participant_email)
    // pour ne pas dupliquer. Sinon crée.
    const { data: existingConv } = await supabase
      .from('email_conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('participant_email', recipientEmail)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    let conversationId: string
    if (existingConv) {
      conversationId = existingConv.id
      await supabase
        .from('email_conversations')
        .update({
          last_message_text: (body_text || body_html || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
          last_message_at: new Date().toISOString(),
          last_message_from: 'user',
          subject: subject.trim(),
          lead_id: resolvedLeadId ?? undefined,
        })
        .eq('id', conversationId)
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('email_conversations')
        .insert({
          workspace_id: workspaceId,
          participant_email: recipientEmail,
          participant_name: resolvedLeadName,
          lead_id: resolvedLeadId,
          subject: subject.trim(),
          root_message_id: newMessageIdHeader,
          last_message_text: (body_text || body_html || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
          last_message_at: new Date().toISOString(),
          last_message_from: 'user',
          unread_count: 0,
        })
        .select('id')
        .single()

      if (convErr || !newConv) {
        return NextResponse.json(
          { error: convErr?.message || 'Création conversation échouée' },
          { status: 500 },
        )
      }
      conversationId = newConv.id
    }

    // Insert le premier message
    await supabase.from('email_messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      ses_message_id: result.messageId || null,
      message_id_header: newMessageIdHeader,
      sender_type: 'user',
      from_email: sender.fromEmail,
      from_name: sender.fromName,
      to_email: recipientEmail,
      subject: subject.trim(),
      body_text: body_text || null,
      body_html: body_html || null,
      sent_at: new Date().toISOString(),
      is_read: true,
    })

    await logEmailSend({
      workspaceId,
      sesMessageId: result.messageId,
      source: 'direct_message',
      leadId: resolvedLeadId,
      subject: subject.trim(),
      fromEmail: sender.fromEmail,
    })

    return NextResponse.json({
      conversation_id: conversationId,
      message_id: result.messageId,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[conversations POST]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
