import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { executeWorkflow } from '@/lib/workflows/engine'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow exists and belongs to workspace
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .single()

    if (wfError || !workflow) {
      return NextResponse.json({ error: 'Workflow non trouve' }, { status: 404 })
    }

    const body = await request.json()
    const leadId = body.lead_id as string
    if (!leadId) {
      return NextResponse.json({ error: 'lead_id requis' }, { status: 400 })
    }

    // Execute in dry-run mode
    await executeWorkflow(workflowId, workspaceId, { lead_id: leadId }, { dryRun: true })

    // Fetch the execution logs that were just created
    const serviceClient = createServiceClient()
    const { data: executions } = await serviceClient
      .from('workflow_executions')
      .select('id, status, started_at, completed_at')
      .eq('workflow_id', workflowId)
      .eq('lead_id', leadId)
      .order('started_at', { ascending: false })
      .limit(1)

    const execution = executions?.[0]
    if (!execution) {
      return NextResponse.json({ error: 'Execution non trouvee' }, { status: 500 })
    }

    const { data: logs } = await serviceClient
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', execution.id)
      .order('step_order', { ascending: true })

    return NextResponse.json({
      data: {
        execution_id: execution.id,
        status: execution.status,
        dry_run: true,
        logs: logs ?? [],
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
