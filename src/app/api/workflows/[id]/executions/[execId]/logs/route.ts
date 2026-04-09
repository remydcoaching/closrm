import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
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

    // Verify execution belongs to this workflow and workspace
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('id')
      .eq('id', execId)
      .eq('workflow_id', workflowId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!execution) {
      return NextResponse.json({ error: 'Execution non trouvee' }, { status: 404 })
    }

    const { data: logs, error } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', execId)
      .order('step_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: logs ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
