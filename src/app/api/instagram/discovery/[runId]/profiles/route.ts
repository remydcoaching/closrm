import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

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

    const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
    const perPage = Math.min(Number(request.nextUrl.searchParams.get('per_page') ?? '50'), 200)
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await supabase
      .from('discovery_profiles')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('discovery_run_id', runId)
      .order('likes_count', { ascending: false })
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
