import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * Content-centric view of Instagram engagement (Instagram > Content).
 * Reads instagram_content_summary (migration 099), a read-only aggregation
 * over instagram_interactions — no duplicated storage, no second source of
 * truth. See CLOSRM_DESKTOP_FINAL_VISION.md §4.3 for why thumbnails are not
 * part of this response (Hiker does not persist them today).
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
    const perPage = Math.min(Number(request.nextUrl.searchParams.get('per_page') ?? '25'), 100)
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await supabase
      .from('instagram_content_summary')
      .select('*', { count: 'planned' })
      .eq('workspace_id', workspaceId)
      .order('last_interaction_at', { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      meta: { total: count ?? 0, page, per_page: perPage, total_pages: count ? Math.ceil(count / perPage) : 1 },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
