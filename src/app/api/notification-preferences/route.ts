import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('type, enabled')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const { type, enabled } = body as { type: string; enabled: boolean }

    if (!type || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'type et enabled requis' }, { status: 400 })
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          workspace_id: workspaceId,
          user_id: userId,
          type,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,user_id,type' },
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
