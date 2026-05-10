import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// DELETE /api/tournage-sessions/:id/reels/:reelId — retire un reel d'une session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reelId: string }> },
) {
  try {
    const { id, reelId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: session } = await supabase
      .from('tournage_sessions')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

    const { error } = await supabase
      .from('tournage_session_reels')
      .delete()
      .eq('session_id', id)
      .eq('social_post_id', reelId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
