import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getValidYoutubeAccessToken } from '@/lib/youtube/api'
import { syncYoutubeAccount } from '@/lib/youtube/sync'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const token = await getValidYoutubeAccessToken(workspaceId)
    if (!token) return NextResponse.json({ error: 'YouTube non connecté' }, { status: 400 })
    const result = await syncYoutubeAccount(workspaceId, token)
    return NextResponse.json({ data: result })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
