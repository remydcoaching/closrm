import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateWorkflowSchema } from '@/lib/validations/workflows'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    // Fetch steps ordered by step_order
    const { data: steps } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', id)
      .eq('workspace_id', workspaceId)
      .order('step_order', { ascending: true })

    // Count executions
    const { count: executionCount } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_id', id)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({
      data: {
        ...workflow,
        steps: steps ?? [],
        execution_count: executionCount ?? 0,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateWorkflowSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data: existing } = await supabase
      .from('workflows').select('*').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!existing) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const { data, error } = await supabase
      .from('workflows')
      .update(parsed.data)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('workflows').delete().eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error || !data) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
