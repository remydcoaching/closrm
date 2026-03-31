import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workflows')
    .select('*, workflow_steps(*)')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Séquence introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()

  // Update workflow metadata
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.status !== undefined) updates.status = body.status

  const { error: wfError } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (wfError) return NextResponse.json({ error: wfError.message }, { status: 500 })

  // Replace steps if provided
  if (body.steps) {
    await supabase.from('workflow_steps').delete().eq('workflow_id', id)

    if (body.steps.length) {
      const steps = body.steps.map((step: Record<string, unknown>, i: number) => ({
        workflow_id: id,
        step_order: i,
        step_type: step.step_type || 'action',
        action_type: step.action_type || null,
        action_config: step.action_config || {},
        delay_value: step.delay_value || null,
        delay_unit: step.delay_unit || null,
      }))
      await supabase.from('workflow_steps').insert(steps)
    }
  }

  // Refetch
  const { data } = await supabase
    .from('workflows')
    .select('*, workflow_steps(*)')
    .eq('id', id)
    .single()

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  await supabase.from('workflow_steps').delete().eq('workflow_id', id)
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
