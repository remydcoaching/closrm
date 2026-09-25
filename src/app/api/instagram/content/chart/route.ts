import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * Data for the Content page's engagement-vs-views scatter chart: joins
 * discovery_contents (migration 103 — view_count, type, published_at from
 * Hiker scans) with instagram_content_summary (099 — OBSERVED interaction
 * counts, works for both Hiker and Apify) by content_id/source_post_id.
 * Only content with a known view_count can be charted (the X axis is views)
 * — content without it (e.g. Apify-only, which never captured views) is
 * simply excluded, never plotted with a fabricated value.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const days = request.nextUrl.searchParams.get('days')
    const since = days ? new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString() : null

    let contentsQuery = supabase
      .from('discovery_contents')
      .select('content_id, content_type, content_url, thumbnail_url, published_at, view_count')
      .eq('workspace_id', workspaceId)
      .not('view_count', 'is', null)

    if (since) contentsQuery = contentsQuery.gte('published_at', since)

    const { data: contents, error: contentsError } = await contentsQuery
    if (contentsError) return NextResponse.json({ error: contentsError.message }, { status: 500 })

    const { data: summaries, error: summaryError } = await supabase
      .from('instagram_content_summary')
      .select('source_post_id, leads_count, likes_count, comments_count, dm_count')
      .eq('workspace_id', workspaceId)

    if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 500 })

    const summaryByPostId = new Map((summaries ?? []).map((s) => [s.source_post_id, s]))

    // engagement rate = (likes + comments) / views — same formula the web's
    // stats module already uses for post-level engagement, not invented here.
    const points = (contents ?? [])
      .filter((c) => c.view_count && c.view_count > 0)
      .map((c) => {
        const summary = summaryByPostId.get(c.content_id)
        const likes = summary?.likes_count ?? 0
        const comments = summary?.comments_count ?? 0
        const engagementRate = (likes + comments) / (c.view_count as number)
        return {
          contentId: c.content_id,
          contentType: c.content_type,
          contentUrl: c.content_url,
          thumbnailUrl: c.thumbnail_url,
          publishedAt: c.published_at,
          views: c.view_count,
          engagementRate,
          leadsCount: summary?.leads_count ?? 0,
          likesCount: likes,
          commentsCount: comments,
        }
      })

    return NextResponse.json({ data: points })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
