import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateStepSchema } from '@/lib/validations/workflows'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('id').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const body = await request.json()
    const parsed = updateStepSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data: existing } = await supabase
      .from('workflow_steps').select('*')
      .eq('id', stepId).eq('workflow_id', id).single()
    if (!existing) return NextResponse.json({ error: 'Étape non trouvée' }, { status: 404 })

    const { data, error } = await supabase
      .from('workflow_steps')
      .update(parsed.data)
      .eq('id', stepId)
      .eq('workflow_id', id)
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
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('id').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const { data: deleted, error } = await supabase
      .from('workflow_steps').delete()
      .eq('id', stepId).eq('workflow_id', id)
      .select().single()
    if (error || !deleted) return NextResponse.json({ error: 'Étape non trouvée' }, { status: 404 })

    // Reorder remaining steps to fill the gap
    const { data: remainingSteps } = await supabase
      .from('workflow_steps')
      .select('id, step_order')
      .eq('workflow_id', id)
      .order('step_order', { ascending: true })

    if (remainingSteps && remainingSteps.length > 0) {
      const reorderUpdates = remainingSteps.map((step, index) =>
        supabase
          .from('workflow_steps')
          .update({ step_order: index + 1 })
          .eq('id', step.id)
      )
      await Promise.all(reorderUpdates)
    }

    return NextResponse.json({ data: deleted })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
