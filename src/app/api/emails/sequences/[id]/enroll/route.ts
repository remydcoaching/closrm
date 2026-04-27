import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { executeWorkflow } from '@/lib/workflows/engine'

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

  // Filter out already enrolled, unsubscribed, and suppressed leads.
  const { data: existingEnrollments } = await supabase
    .from('email_sequence_enrollments')
    .select('lead_id')
    .eq('sequence_id', sequenceId)
    .in('lead_id', leadIds)

  const { data: unsubscribedLeads } = await supabase
    .from('leads')
    .select('id, email')
    .in('id', leadIds)
    .eq('email_unsubscribed', true)

  // Exclure aussi les leads dont l'email est dans la suppression list —
  // pas la peine d'enroller des emails qui bounceraient de toute façon.
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, email')
    .in('id', leadIds)

  const emailsLower = (allLeads || [])
    .map((l) => l.email?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e))

  const { data: suppressed } = emailsLower.length
    ? await supabase
        .from('email_suppressions')
        .select('email')
        .in('email', emailsLower)
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    : { data: [] as { email: string }[] }

  const suppressedEmails = new Set((suppressed || []).map((s) => s.email))
  const suppressedLeadIds = (allLeads || [])
    .filter((l) => l.email && suppressedEmails.has(l.email.trim().toLowerCase()))
    .map((l) => l.id)

  const excludeIds = new Set([
    ...(existingEnrollments || []).map((e) => e.lead_id),
    ...(unsubscribedLeads || []).map((l) => l.id),
    ...suppressedLeadIds,
  ])

  const newLeadIds = leadIds.filter((id) => !excludeIds.has(id))

  if (!newLeadIds.length) {
    return NextResponse.json({ enrolled: 0, skipped: leadIds.length })
  }

  const enrollments = newLeadIds.map((leadId) => ({
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

  // Kick off l'exécution du workflow pour chaque lead enrollé. Le moteur
  // (executeWorkflow) gère les delays via workflow_executions + le cron
  // `/api/cron/workflow-scheduler` qui resume les exécutions paused.
  //
  // On attend toutes les exécutions initiales (pas les delays) pour que le
  // user voie les premiers envois. Si un lead échoue, on log mais on ne
  // bloque pas les autres.
  await Promise.allSettled(
    newLeadIds.map((leadId) =>
      executeWorkflow(sequenceId, workspaceId, { lead_id: leadId }).catch((err) => {
        console.error(
          `[sequences/enroll] executeWorkflow failed for lead ${leadId}`,
          err,
        )
      }),
    ),
  )

  return NextResponse.json({
    enrolled: newLeadIds.length,
    skipped: leadIds.length - newLeadIds.length,
  })
}
