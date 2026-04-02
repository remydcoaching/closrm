import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { syncAll, syncStories } from '@/lib/instagram/sync'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: account } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Aucun compte Instagram connecté' }, { status: 400 })
    }

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') ?? 'full'

    const ctx = {
      supabase,
      workspaceId,
      accessToken: account.access_token,
      igUserId: account.ig_user_id,
      pageId: account.page_id ?? undefined,
      pageAccessToken: account.page_access_token ?? undefined,
    }

    if (mode === 'stories') {
      const count = await syncStories(ctx)
      return NextResponse.json({ data: { storiesCount: count } })
    }

    const result = await syncAll(ctx)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /instagram/sync] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
