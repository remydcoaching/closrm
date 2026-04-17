import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createStepSchema, reorderStepsSchema } from '@/lib/validations/workflows'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('id').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const { data, error } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', id)
      .order('step_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('id').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const body = await request.json()
    const parsed = createStepSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Calculate insertion position
    const insertAfter = parsed.data.insert_after ?? null

    if (insertAfter !== null) {
      // Shift all steps after the insertion point
      const { data: stepsToShift } = await supabase
        .from('workflow_steps')
        .select('id, step_order')
        .eq('workflow_id', id)
        .gt('step_order', insertAfter)
        .order('step_order', { ascending: false })

      if (stepsToShift?.length) {
        await Promise.all(
          stepsToShift.map((s) =>
            supabase
              .from('workflow_steps')
              .update({ step_order: s.step_order + 1 })
              .eq('id', s.id)
          )
        )
      }
    }

    const newOrder = insertAfter !== null
      ? insertAfter + 1
      : ((await supabase
          .from('workflow_steps')
          .select('step_order')
          .eq('workflow_id', id)
          .order('step_order', { ascending: false })
          .limit(1)
          .single()
        ).data?.step_order ?? 0) + 1

    const { data, error } = await supabase
      .from('workflow_steps')
      .insert({
        workflow_id: id,
        step_order: newOrder,
        step_type: parsed.data.step_type,
        action_type: parsed.data.action_type || null,
        action_config: parsed.data.action_config || {},
        delay_value: parsed.data.delay_value || null,
        delay_unit: parsed.data.delay_unit || null,
        parent_step_id: parsed.data.parent_step_id || null,
        branch: parsed.data.branch || 'main',
        condition_field: parsed.data.condition_field || null,
        condition_operator: parsed.data.condition_operator || null,
        condition_value: parsed.data.condition_value || null,
        on_true_step: parsed.data.on_true_step || null,
        on_false_step: parsed.data.on_false_step || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows').select('id').eq('id', id).eq('workspace_id', workspaceId).single()
    if (!workflow) return NextResponse.json({ error: 'Workflow non trouvé' }, { status: 404 })

    const body = await request.json()
    const parsed = reorderStepsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Update each step's order
    const updates = parsed.data.map((item) =>
      supabase
        .from('workflow_steps')
        .update({ step_order: item.step_order })
        .eq('id', item.id)
        .eq('workflow_id', id)
    )

    const results = await Promise.all(updates)
    const hasError = results.find((r) => r.error)
    if (hasError?.error) return NextResponse.json({ error: hasError.error.message }, { status: 500 })

    // Return updated steps
    const { data: steps } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', id)
      .order('step_order', { ascending: true })

    return NextResponse.json({ data: steps ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
