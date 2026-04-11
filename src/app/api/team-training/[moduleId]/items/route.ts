import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { workspaceId, role } = await getWorkspaceId()
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { moduleId } = await params
    const supabase = await createClient()

    // Verify the module belongs to this workspace
    const { data: mod } = await supabase
      .from('team_training_modules')
      .select('id')
      .eq('id', moduleId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!mod) {
      return NextResponse.json({ error: 'Module introuvable.' }, { status: 404 })
    }

    const body = await request.json()

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'Le titre est requis.' }, { status: 400 })
    }

    const validTypes = ['pdf', 'video', 'link', 'text', 'checklist']
    const type = validTypes.includes(body.type) ? body.type : null
    if (!type) {
      return NextResponse.json({ error: 'Type invalide.' }, { status: 400 })
    }

    const content = typeof body.content === 'string' ? body.content.trim() : null

    // Get next sort_order
    const { count } = await supabase
      .from('team_training_items')
      .select('*', { count: 'exact', head: true })
      .eq('module_id', moduleId)

    const { data, error } = await supabase
      .from('team_training_items')
      .insert({
        module_id: moduleId,
        workspace_id: workspaceId,
        type,
        title,
        content,
        sort_order: (count ?? 0),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
