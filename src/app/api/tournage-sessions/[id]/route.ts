import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET /api/tournage-sessions/:id  — détail avec reels liés
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data: session, error } = await supabase
      .from('tournage_sessions')
      .select(`
        *,
        reels:tournage_session_reels (
          social_post_id, position, added_at,
          post:social_posts (id, title, hook, script, content_kind)
        )
      `)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    return NextResponse.json({ data: session })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// PATCH /api/tournage-sessions/:id
// Body: { name?, scheduled_date?, status?, monteur_id?, notes?, brief_sent_at? }
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
    if ('name' in body) update.name = body.name?.trim() || null
    if ('scheduled_date' in body) update.scheduled_date = body.scheduled_date || null
    if ('status' in body) {
      if (!['draft', 'ready', 'in_progress', 'completed', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      update.status = body.status
    }
    if ('monteur_id' in body) update.monteur_id = body.monteur_id || null
    if ('notes' in body) update.notes = body.notes?.trim() || null
    if ('brief_sent_at' in body) update.brief_sent_at = body.brief_sent_at || null
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tournage_sessions')
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

// DELETE /api/tournage-sessions/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { error } = await supabase
      .from('tournage_sessions')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
