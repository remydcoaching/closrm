import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: asset } = await supabase
      .from('workflow_assets')
      .select('storage_path')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!asset) return NextResponse.json({ error: 'Asset introuvable' }, { status: 404 })

    if (asset.storage_path) {
      await supabase.storage.from('workflow-assets').remove([asset.storage_path])
    }

    const { error } = await supabase
      .from('workflow_assets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
