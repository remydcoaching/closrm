import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'
import { sendThreadedEmail } from '@/lib/email/send-raw'

export async function GET(request: Request) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('email_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Marquer le thread comme lu
    await supabase
      .from('email_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'participant')
      .eq('is_read', false)

    await supabase
      .from('email_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body invalide' }, { status: 400 })
    }
    const { conversation_id, body_html, body_text, subject: subjectOverride } = body as {
      conversation_id?: string
      body_html?: string
      body_text?: string
      subject?: string
    }

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id requis' }, { status: 400 })
    }
    if (!body_html && !body_text) {
      return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })
    }

    const { data: conv, error: convErr } = await supabase
      .from('email_conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Récupérer le dernier message du participant pour threading
    const { data: lastParticipantMsg } = await supabase
      .from('email_messages')
      .select('message_id_header, references_header')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'participant')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const inReplyTo = lastParticipantMsg?.message_id_header || null
    const existingRefs = lastParticipantMsg?.references_header || ''
    const references = inReplyTo
      ? `${existingRefs} ${inReplyTo}`.trim()
      : existingRefs || null

    const sender = await getWorkspaceSenderConfig(workspaceId)
    const subject =
      subjectOverride ||
      (conv.subject ? (conv.subject.startsWith('Re:') ? conv.subject : `Re: ${conv.subject}`) : '(Sans objet)')

    const result = await sendThreadedEmail({
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      replyTo: sender.replyTo,
      to: conv.participant_email,
      subject,
      bodyHtml: body_html,
      bodyText: body_text,
      inReplyTo,
      references,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Envoi échoué' }, { status: 500 })
    }

    // Message-ID RFC 5322 que le destinataire verra
    const newMessageIdHeader = result.messageId ? `<${result.messageId}@email.amazonses.com>` : null

    const { data: inserted, error: insertErr } = await supabase
      .from('email_messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id,
        ses_message_id: result.messageId || null,
        message_id_header: newMessageIdHeader,
        in_reply_to: inReplyTo,
        references_header: references,
        sender_type: 'user',
        from_email: sender.fromEmail,
        from_name: sender.fromName,
        to_email: conv.participant_email,
        subject,
        body_text: body_text || null,
        body_html: body_html || null,
        sent_at: new Date().toISOString(),
        is_read: true,
      })
      .select('*')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    await supabase
      .from('email_conversations')
      .update({
        last_message_text: (body_text || body_html || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
        last_message_at: new Date().toISOString(),
        last_message_from: 'user',
      })
      .eq('id', conversation_id)

    return NextResponse.json({ data: inserted })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
