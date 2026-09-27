import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { highlightTagsSchema, loadHighlightViewers, tagHighlightStories } from '@/lib/instagram/highlight-viewers'
import { invalidateStoryLurkers } from '@/lib/instagram/story-lurkers'

/**
 * Stories "à la une".
 * POST — { items: [{ pk, highlightId, highlightTitle }] } from the desktop's
 *        highlight tray: tags the stories ClosRM already stores.
 * GET  — `?pks=1,2,3`: who viewed those stories (per person, number of
 *        stories seen) and, per story, whether its viewers are known.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const parsed = highlightTagsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides' }, { status: 400 })
    }
    const result = await tagHighlightStories(supabase, workspaceId, parsed.data)
    if (result.tagged > 0) invalidateStoryLurkers(workspaceId)
    return NextResponse.json({ data: result }, { status: result.errors.length > 0 ? 207 : 200 })
  } catch (err) {
    return failure(err)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const pks = [...new Set((request.nextUrl.searchParams.get('pks') ?? '').split(',').filter((p) => /^\d{1,30}$/.test(p)))].slice(0, 300)
    if (pks.length === 0) return NextResponse.json({ data: { stories: [], viewers: [] } })
    return NextResponse.json({ data: await loadHighlightViewers(supabase, workspaceId, pks) })
  } catch (err) {
    return failure(err)
  }
}

function failure(err: unknown) {
  if (err instanceof Error && err.message === 'Not authenticated') {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}
