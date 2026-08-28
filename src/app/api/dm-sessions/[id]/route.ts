import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: session, error } = await supabase
      .from('dm_sessions')
      .select('*, items:dm_session_items(*, lead:leads(id, first_name, last_name, instagram_handle, instagram_user_id, status, last_activity_at))')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    return NextResponse.json({ data: session })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
