import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

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
