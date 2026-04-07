import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

const VERIFY_TOKEN = process.env.IG_WEBHOOK_VERIFY_TOKEN
if (!VERIFY_TOKEN) console.warn('[Webhook] IG_WEBHOOK_VERIFY_TOKEN not set')

function verifySignature(rawBody: string, signature: string | null): boolean {
  // Skip verification if META_APP_SECRET is not configured
  if (!process.env.META_APP_SECRET) return true
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET).update(rawBody).digest('hex')
  return signature === expected
}

// ─── GET : webhook verification (Meta sends this to validate the endpoint) ───

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && (token === VERIFY_TOKEN || !VERIFY_TOKEN)) {
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
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifySignature(rawBody, signature)) {
      console.warn('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const body = JSON.parse(rawBody) as WebhookPayload

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
          .select('id, unread_count')
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
            unread_count: existingConvo ? (existingConvo.unread_count ?? 0) + 1 : 1,
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
