import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendMessageSchema } from '@/lib/validations/instagram'
import { sendIgMessage } from '@/lib/instagram/api'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Get account
    const { data: account } = await supabase
      .from('ig_accounts').select('*').eq('workspace_id', workspaceId).eq('is_connected', true).single()

    if (!account?.page_id || !account?.page_access_token) {
      return NextResponse.json({ error: 'Compte Instagram non configuré pour les messages' }, { status: 400 })
    }

    // Get conversation
    const { data: convo } = await supabase
      .from('ig_conversations').select('participant_ig_id')
      .eq('id', parsed.data.conversation_id).eq('workspace_id', workspaceId).single()

    if (!convo?.participant_ig_id) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    // Send via IG API
    const messageId = await sendIgMessage(
      account.page_access_token,
      account.page_id,
      convo.participant_ig_id,
      parsed.data.text
    )

    // Save to DB
    const { data: msg, error } = await supabase
      .from('ig_messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id: parsed.data.conversation_id,
        ig_message_id: messageId,
        sender_type: 'user',
        text: parsed.data.text,
        sent_at: new Date().toISOString(),
        is_read: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update conversation
    await supabase
      .from('ig_conversations')
      .update({
        last_message_text: parsed.data.text,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.conversation_id)

    return NextResponse.json({ data: msg }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    console.error('[API /instagram/messages/send] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
