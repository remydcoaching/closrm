import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { orSearchTerm } from '@/lib/supabase/or-search'

/**
 * Lists the profiles observed during a Ciblage (Discovery) run — people who
 * liked or commented on the analyzed account's public content, with their
 * like/comment counts, follow status, and whether they're already a lead.
 * None of these are leads unless matched_lead_id is set (either matched at
 * scan time or created later via the "Cibler" action).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const sp = request.nextUrl.searchParams
    const page = Math.max(Number(sp.get('page') ?? '1') || 1, 1)
    const perPage = Math.min(Math.max(Number(sp.get('per_page') ?? '50') || 50, 1), 200)
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const filter = sp.get('filter') ?? 'all'
    const sort = sp.get('sort') === 'comments_count' ? 'comments_count' : sp.get('sort') === 'instagram_username' ? 'instagram_username' : 'likes_count'
    const ascending = sp.get('order') === 'asc'
    // Strip PostgREST filter syntax characters from the free-text search.
    const search = (sp.get('search') ?? '').replace(/[,()*%]/g, ' ').trim()

    const base = () =>
      supabase.from('discovery_profiles').select('*', { count: 'exact' }).eq('workspace_id', workspaceId).eq('discovery_run_id', runId)

    type Q = ReturnType<typeof base>
    const applyFilter = (q: Q, f: string): Q => {
      switch (f) {
        case 'not_leads':
          return q.is('matched_lead_id', null)
        case 'leads':
          return q.not('matched_lead_id', 'is', null)
        case 'following':
          return q.eq('follows_target', true)
        case 'not_following':
          return q.eq('follows_target', false)
        case 'commenters':
          return q.gt('comments_count', 0)
        default:
          return q
      }
    }

    let query = applyFilter(base(), filter)
    if (search) {
      const term = orSearchTerm(search)
      if (term) query = query.or(`instagram_username.ilike.%${term}%,full_name.ilike.%${term}%`)
    }
    const { data, error, count } = await query.order(sort, { ascending }).order('instagram_username').range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Per-filter totals for the chips (head-only count queries).
    const filterKeys = ['all', 'not_leads', 'leads', 'following', 'not_following', 'commenters']
    const countResults = await Promise.all(
      filterKeys.map((f) => applyFilter(supabase.from('discovery_profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('discovery_run_id', runId) as unknown as Q, f)),
    )
    const counts = Object.fromEntries(filterKeys.map((f, i) => [f, countResults[i].count ?? 0]))

    const { data: run } = await supabase
      .from('discovery_runs')
      .select('instagram_username, status, started_at, completed_at, contents_found, users_found')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .maybeSingle()

    return NextResponse.json({
      data: data ?? [],
      run,
      counts,
      meta: { total: count ?? 0, page, per_page: perPage, total_pages: count ? Math.ceil(count / perPage) : 1 },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
