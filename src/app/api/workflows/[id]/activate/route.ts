import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow exists and belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('*').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    // Validate that at least 1 step exists
    const { count } = await supabase
      .from('workflow_steps')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_id', id)
      .eq('workspace_id', workspaceId)

    if (!count || count === 0) {
      return NextResponse.json(
        { error: 'Le workflow doit contenir au moins une étape pour être activé.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('workflows')
      .update({ status: 'actif' })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
