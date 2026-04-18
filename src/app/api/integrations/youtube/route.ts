import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data } = await supabase
      .from('integrations')
      .select('id, type, is_active, connected_at')
      .eq('workspace_id', workspaceId)
      .eq('type', 'youtube')
      .maybeSingle()
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    // Supprime l'integration ET les données YouTube liées (yt_accounts CASCADE supprimera le reste)
    await supabase.from('integrations').delete().eq('workspace_id', workspaceId).eq('type', 'youtube')
    await supabase.from('yt_accounts').delete().eq('workspace_id', workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
