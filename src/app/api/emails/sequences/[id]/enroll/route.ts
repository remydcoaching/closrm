import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id: sequenceId } = await context.params
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()
  const body = await request.json()
  const leadIds: string[] = body.lead_ids || []

  if (!leadIds.length) {
    return NextResponse.json({ error: 'Aucun lead sélectionné' }, { status: 400 })
  }

  // Filter out already enrolled and unsubscribed leads
  const { data: existingEnrollments } = await supabase
    .from('email_sequence_enrollments')
    .select('lead_id')
    .eq('sequence_id', sequenceId)
    .in('lead_id', leadIds)

  const { data: unsubscribedLeads } = await supabase
    .from('leads')
    .select('id')
    .in('id', leadIds)
    .eq('email_unsubscribed', true)

  const excludeIds = new Set([
    ...(existingEnrollments || []).map(e => e.lead_id),
    ...(unsubscribedLeads || []).map(l => l.id),
  ])

  const newLeadIds = leadIds.filter(id => !excludeIds.has(id))

  if (!newLeadIds.length) {
    return NextResponse.json({ enrolled: 0, skipped: leadIds.length })
  }

  const enrollments = newLeadIds.map(leadId => ({
    workspace_id: workspaceId,
    sequence_id: sequenceId,
    lead_id: leadId,
    status: 'active',
    current_step: 0,
  }))

  const { error } = await supabase
    .from('email_sequence_enrollments')
    .insert(enrollments)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    enrolled: newLeadIds.length,
    skipped: leadIds.length - newLeadIds.length,
  })
}
