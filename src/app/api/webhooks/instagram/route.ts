import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const VERIFY_TOKEN = process.env.IG_WEBHOOK_VERIFY_TOKEN ?? 'closrm_ig_webhook_2026'

// ─── GET : webhook verification (Meta sends this to validate the endpoint) ───

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST : Instagram events (messages, comments, etc.) ─────────────────────

interface IgMessageEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{
      type: string
      payload: { url: string }
    }>
  }
}

interface WebhookEntry {
  id: string
  time: number
  messaging?: IgMessageEvent[]
}

interface WebhookPayload {
  object: string
  entry: WebhookEntry[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WebhookPayload

    // Only process instagram events
    if (body.object !== 'instagram') {
      return NextResponse.json({ received: true })
    }

    const supabase = createServiceClient()

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        if (!event.message) continue

        const senderId = event.sender.id
        const recipientId = event.recipient.id
        const messageId = event.message.mid
        const text = event.message.text ?? null
        const attachment = event.message.attachments?.[0]
        const mediaUrl = attachment?.payload?.url ?? null
        const mediaType = attachment?.type ?? null

        // Find the ig_account by page/ig user id (recipient is us)
        const { data: account } = await supabase
          .from('ig_accounts')
          .select('workspace_id, ig_user_id')
          .or(`ig_user_id.eq.${recipientId},page_id.eq.${recipientId}`)
          .limit(1)
          .single()

        if (!account) continue

        // Find or create conversation
        const { data: existingConvo } = await supabase
          .from('ig_conversations')
          .select('id')
          .eq('workspace_id', account.workspace_id)
          .eq('participant_ig_id', senderId)
          .single()

        let conversationId: string

        if (existingConvo) {
          conversationId = existingConvo.id
        } else {
          const { data: newConvo } = await supabase
            .from('ig_conversations')
            .insert({
              workspace_id: account.workspace_id,
              ig_conversation_id: `${senderId}_${recipientId}`,
              participant_ig_id: senderId,
              unread_count: 0,
            })
            .select('id')
            .single()

          if (!newConvo) continue
          conversationId = newConvo.id
        }

        // Insert message
        await supabase.from('ig_messages').upsert({
          workspace_id: account.workspace_id,
          conversation_id: conversationId,
          ig_message_id: messageId,
          sender_type: 'participant',
          text,
          media_url: mediaUrl,
          media_type: mediaType as 'image' | 'video' | 'audio' | 'sticker' | null,
          sent_at: new Date(event.timestamp).toISOString(),
          is_read: false,
        }, { onConflict: 'ig_message_id' })

        // Update conversation
        await supabase
          .from('ig_conversations')
          .update({
            last_message_text: text ?? '📎 Média',
            last_message_at: new Date(event.timestamp).toISOString(),
            unread_count: (existingConvo ? 1 : 1), // Will be incremented properly with RPC later
          })
          .eq('id', conversationId)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Webhook /instagram] Error:', err)
    return NextResponse.json({ received: true })
  }
}
