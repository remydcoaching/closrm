import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// POST /api/tournage-sessions/:id/reels
// Body: { social_post_ids: string[] }  — ajoute des reels à la session (idempotent)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.social_post_ids)
      ? body.social_post_ids.filter((i: unknown) => typeof i === 'string')
      : []
    if (ids.length === 0) return NextResponse.json({ error: 'social_post_ids requis' }, { status: 400 })

    // Vérifie que la session appartient au workspace
    const { data: session } = await supabase
      .from('tournage_sessions')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    // Récupère la position max pour ajouter à la suite
    const { data: existing } = await supabase
      .from('tournage_session_reels')
      .select('position')
      .eq('session_id', id)
      .order('position', { ascending: false })
      .limit(1)
    const startPos = (existing?.[0]?.position ?? -1) + 1

    const rows = ids.map((postId, i) => ({
      session_id: id,
      social_post_id: postId,
      position: startPos + i,
    }))

    const { error } = await supabase
      .from('tournage_session_reels')
      .upsert(rows, { onConflict: 'session_id,social_post_id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ added: ids.length })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
