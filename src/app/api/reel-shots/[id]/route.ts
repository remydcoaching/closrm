import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// PATCH /api/reel-shots/:id
// Body : { location?, shot_note?, done?, skipped? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    const update: Record<string, unknown> = {}
    if ('location' in body) update.location = body.location || null
    if ('shot_note' in body) update.shot_note = body.shot_note || null
    if ('done' in body) {
      update.done = !!body.done
      // Trace done_at au passage true, conserve à la dernière valeur si on retoggle false→true
      if (body.done) update.done_at = new Date().toISOString()
    }
    if ('skipped' in body) update.skipped = !!body.skipped
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reel_shots')
      .update(update)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
