import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/reel-shots/stats
// Retourne pour chaque social_post_id du workspace :
// { [social_post_id]: { total, done, skipped } }
// Permet d'afficher des badges de progression sur le planning sans fetch lourd.
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reel_shots')
      .select('social_post_id, done, skipped')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const stats: Record<string, { total: number; done: number; skipped: number }> = {}
    for (const row of data ?? []) {
      const id = row.social_post_id as string
      if (!stats[id]) stats[id] = { total: 0, done: 0, skipped: 0 }
      stats[id].total++
      if (row.done) stats[id].done++
      if (row.skipped) stats[id].skipped++
    }
    return NextResponse.json({ data: stats })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
