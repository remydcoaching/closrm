import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { fetchConversationMessages } from '@/lib/instagram/api'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const conversationId = request.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) return NextResponse.json({ error: 'conversation_id requis' }, { status: 400 })

    // Verify conversation belongs to this workspace
    const { data: convo } = await supabase
      .from('ig_conversations')
      .select('id, ig_conversation_id, participant_ig_id')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!convo) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })

    const { data, error } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('workspace_id', workspaceId)
      .order('sent_at', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If no local messages, try to fetch from Meta API
    if (!data || data.length === 0) {
      try {
        const { data: account } = await supabase
          .from('ig_accounts')
          .select('ig_user_id, page_access_token')
          .eq('workspace_id', workspaceId)
          .eq('is_connected', true)
          .maybeSingle()

        if (account?.page_access_token && convo.ig_conversation_id) {
          const rawMessages = await fetchConversationMessages(
            account.page_access_token,
            convo.ig_conversation_id,
            50
          )

          if (rawMessages.length > 0) {
            const toInsert = rawMessages.map(msg => ({
              workspace_id: workspaceId,
              conversation_id: conversationId,
              ig_message_id: msg.id,
              sender_type: msg.from.id === account.ig_user_id ? 'user' as const : 'participant' as const,
              text: msg.message ?? null,
              media_url: msg.attachments?.data?.[0]?.image_data?.url
                ?? msg.attachments?.data?.[0]?.video_data?.url
                ?? null,
              media_type: msg.attachments?.data?.[0]?.mime_type?.startsWith('video') ? 'video' as const
                : msg.attachments?.data?.[0]?.mime_type?.startsWith('image') ? 'image' as const
                : msg.attachments?.data?.[0]?.mime_type?.startsWith('audio') ? 'audio' as const
                : null,
              sent_at: msg.created_time,
              is_read: true,
            }))

            await supabase.from('ig_messages').upsert(toInsert, { onConflict: 'ig_message_id' })

            // Re-query to return clean data
            const { data: freshData } = await supabase
              .from('ig_messages')
              .select('*')
              .eq('conversation_id', conversationId)
              .eq('workspace_id', workspaceId)
              .order('sent_at', { ascending: true })
              .limit(100)

            return NextResponse.json({ data: freshData ?? [] })
          }
        }
      } catch (fetchErr) {
        console.error('[API /instagram/messages] Meta fetch failed:', fetchErr)
        // Return empty — graceful degradation
      }
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
