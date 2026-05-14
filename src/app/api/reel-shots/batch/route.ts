import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// POST /api/reel-shots/batch
// Body : { ids: string[], patch: { location?, shot_note?, done?, skipped? } }
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body.ids) ? body.ids.filter((i: unknown) => typeof i === 'string') : []
    const patch = body.patch ?? {}
    if (ids.length === 0) return NextResponse.json({ error: 'ids requis' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if ('location' in patch) update.location = patch.location || null
    if ('shot_note' in patch) update.shot_note = patch.shot_note || null
    if ('done' in patch) {
      update.done = !!patch.done
      if (patch.done) update.done_at = new Date().toISOString()
    }
    if ('skipped' in patch) update.skipped = !!patch.skipped
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reel_shots')
      .update(update)
      .in('id', ids)
      .eq('workspace_id', workspaceId)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updated: data?.length ?? 0 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
