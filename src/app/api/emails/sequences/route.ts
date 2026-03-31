import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  // Sequences are workflows with trigger_type = 'manual' and a naming convention
  // We tag them via trigger_config.sequence = true
  const { data, error } = await supabase
    .from('workflows')
    .select('*, workflow_steps(*)')
    .eq('workspace_id', workspaceId)
    .eq('trigger_config->>sequence', 'true')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()

  // Create workflow as email sequence
  const { data: workflow, error: wfError } = await supabase
    .from('workflows')
    .insert({
      workspace_id: workspaceId,
      name: body.name || 'Nouvelle séquence',
      description: body.description || null,
      trigger_type: 'new_lead',
      trigger_config: { sequence: true },
      status: 'brouillon',
    })
    .select()
    .single()

  if (wfError || !workflow) {
    return NextResponse.json({ error: wfError?.message || 'Erreur création' }, { status: 500 })
  }

  // Create default steps if provided
  if (body.steps?.length) {
    const steps = body.steps.map((step: { template_id?: string; delay_value?: number; delay_unit?: string }, i: number) => ({
      workflow_id: workflow.id,
      step_order: i * 2,
      step_type: 'action' as const,
      action_type: 'send_email' as const,
      action_config: { template_id: step.template_id },
      ...(i < body.steps.length - 1 ? {} : {}),
    }))

    // Interleave with delay steps
    const allSteps: Record<string, unknown>[] = []
    for (let i = 0; i < steps.length; i++) {
      allSteps.push(steps[i])
      if (i < steps.length - 1 && body.steps[i + 1]) {
        allSteps.push({
          workflow_id: workflow.id,
          step_order: i * 2 + 1,
          step_type: 'delay',
          delay_value: body.steps[i].delay_value || 1,
          delay_unit: body.steps[i].delay_unit || 'days',
          action_config: {},
        })
      }
    }

    if (allSteps.length) {
      await supabase.from('workflow_steps').insert(allSteps)
    }
  }

  return NextResponse.json(workflow, { status: 201 })
}
