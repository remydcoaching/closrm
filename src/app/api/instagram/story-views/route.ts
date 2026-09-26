import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { persistStoryViews, storyViewsPayloadSchema } from '@/lib/instagram/story-views'
import { invalidateStoryLurkers, loadStoryLurkers } from '@/lib/instagram/story-lurkers'
import { loadStoryDetail } from '@/lib/instagram/story-detail'

/**
 * Story viewers of the coach's own account.
 * POST — pushed by ClosRM Desktop, which reads them from the coach's own
 *        Instagram session while stories are live (the session itself never
 *        reaches this server — only viewer identities).
 * GET  — `?story=<pk>`: viewers of one story. `?stories=N` (default 10): viewers of the last N collected stories,
 *        with assiduité (stories viewed out of N) and lurkers (never contacted).
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const parsed = storyViewsPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides' }, { status: 400 })
    }
    const result = await persistStoryViews(supabase, workspaceId, parsed.data)
    invalidateStoryLurkers(workspaceId)
    return NextResponse.json({ data: result }, { status: result.errors.length > 0 ? 207 : 200 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    // ?story=<pk>: that story and its viewers, with lead + score when known.
    const storyPk = request.nextUrl.searchParams.get('story')
    if (storyPk) return NextResponse.json({ data: await loadStoryDetail(supabase, workspaceId, storyPk) })
    const n = Math.min(Math.max(Number(request.nextUrl.searchParams.get('stories')) || 10, 1), 100)
    return NextResponse.json({ data: await loadStoryLurkers(supabase, workspaceId, n) })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (err instanceof Error && /does not exist|Could not find the table|schema cache/i.test(err.message)) {
      return NextResponse.json({ error: 'Migration 106 non appliquée' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
