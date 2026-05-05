import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/social/posts/messages-unread
// Retourne un map { slotId: unreadCount } pour tous les slots du workspace
// que l'utilisateur courant peut voir (RLS social_posts).
//
// Calcul : pour chaque slot, count(messages WHERE created_at > last_read_at
//          AND author_id != current_user). Si pas de last_read_at en DB,
//          tous les messages comptent comme non-lus.
//
// Implementation simple : on charge tous les messages des slots accessibles
// + tous les reads de l'utilisateur, puis on agrege cote serveur.
// Pour un workspace avec < 5000 messages c'est largement suffisant.
export async function GET(_request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    const [messagesRes, readsRes] = await Promise.all([
      supabase
        .from('social_post_messages')
        .select('id, social_post_id, author_id, created_at')
        .eq('workspace_id', workspaceId)
        .neq('author_id', userId) // les messages de l'utilisateur sont toujours "lus"
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('social_post_message_reads')
        .select('social_post_id, last_read_at')
        .eq('user_id', userId),
    ])

    if (messagesRes.error) throw messagesRes.error
    if (readsRes.error) throw readsRes.error

    const lastReadBySlot = new Map<string, string>()
    for (const r of readsRes.data ?? []) {
      lastReadBySlot.set(r.social_post_id, r.last_read_at)
    }

    const unreadBySlot: Record<string, number> = {}
    for (const m of messagesRes.data ?? []) {
      const lastRead = lastReadBySlot.get(m.social_post_id)
      if (!lastRead || m.created_at > lastRead) {
        unreadBySlot[m.social_post_id] = (unreadBySlot[m.social_post_id] ?? 0) + 1
      }
    }

    return NextResponse.json({ data: unreadBySlot })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
