import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { executeWorkflow, type TriggerData } from '@/lib/workflows/engine'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; execId: string }> }
) {
  try {
    const { id: workflowId, execId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify workflow belongs to workspace
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow non trouve' }, { status: 404 })
    }

    // Fetch execution
    const serviceClient = createServiceClient()
    const { data: execution } = await serviceClient
      .from('workflow_executions')
      .select('id, status, trigger_data, workspace_id')
      .eq('id', execId)
      .eq('workflow_id', workflowId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!execution) {
      return NextResponse.json({ error: 'Execution non trouvee' }, { status: 404 })
    }

    if (execution.status !== 'failed') {
      return NextResponse.json({ error: 'Seules les executions en echec peuvent etre relancees' }, { status: 400 })
    }

    // Reset execution status
    await serviceClient
      .from('workflow_executions')
      .update({
        status: 'running',
        current_step: 1,
        error_message: null,
        completed_at: null,
      })
      .eq('id', execId)

    // Re-execute with the same trigger data
    const triggerData = (execution.trigger_data ?? {}) as TriggerData
    executeWorkflow(workflowId, workspaceId, triggerData).catch(err => {
      console.error(`[workflow-retry] Error re-executing workflow ${workflowId}:`, err)
    })

    return NextResponse.json({ data: { execution_id: execId, status: 'running' } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
