import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { batchId } = await params

    const { data, error } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Batch non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { batchId } = await params

    // Verify batch exists and belongs to workspace
    const { data: batch, error: batchError } = await supabase
      .from('lead_import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('workspace_id', workspaceId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch non trouvé' }, { status: 404 })
    }

    // Find leads that have calls or follow-ups (can't delete)
    const { data: protectedLeads } = await supabase
      .from('leads')
      .select('id, calls(id), follow_ups(id)')
      .eq('import_batch_id', batchId)
      .eq('workspace_id', workspaceId)

    const deletableIds: string[] = []
    const protectedCount = (protectedLeads || []).filter((lead) => {
      const hasCalls = Array.isArray(lead.calls) && lead.calls.length > 0
      const hasFollowUps = Array.isArray(lead.follow_ups) && lead.follow_ups.length > 0
      if (hasCalls || hasFollowUps) return true
      deletableIds.push(lead.id)
      return false
    }).length

    // Delete eligible leads
    if (deletableIds.length > 0) {
      await supabase
        .from('leads')
        .delete()
        .in('id', deletableIds)
    }

    // Update batch status
    await supabase
      .from('lead_import_batches')
      .update({ status: 'cancelled' })
      .eq('id', batchId)

    return NextResponse.json({
      data: {
        deleted: deletableIds.length,
        protected: protectedCount,
        message: protectedCount > 0
          ? `${deletableIds.length} leads supprimés. ${protectedCount} leads conservés car ils ont des appels ou follow-ups.`
          : `${deletableIds.length} leads supprimés.`,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
