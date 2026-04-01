import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Verify funnel belongs to workspace
    const { data: funnel, error: funnelError } = await supabase
      .from('funnels')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Funnel introuvable' }, { status: 404 })
    }

    const days = parseInt(request.nextUrl.searchParams.get('days') ?? '30', 10)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceIso = since.toISOString()

    // Get all pages for this funnel
    const { data: pages } = await supabase
      .from('funnel_pages')
      .select('id, name, slug, page_order, views_count, submissions_count')
      .eq('funnel_id', id)
      .eq('workspace_id', workspaceId)
      .order('page_order', { ascending: true })

    const pageIds = (pages ?? []).map((p) => p.id)

    // Get events within the time range
    let events: { funnel_page_id: string; event_type: string }[] = []
    if (pageIds.length > 0) {
      const { data: eventData } = await supabase
        .from('funnel_events')
        .select('funnel_page_id, event_type')
        .in('funnel_page_id', pageIds)
        .gte('created_at', sinceIso)

      events = eventData ?? []
    }

    // Aggregate events by page and type
    const eventsByPage: Record<string, Record<string, number>> = {}
    for (const event of events) {
      if (!eventsByPage[event.funnel_page_id]) {
        eventsByPage[event.funnel_page_id] = {}
      }
      const bucket = eventsByPage[event.funnel_page_id]
      bucket[event.event_type] = (bucket[event.event_type] ?? 0) + 1
    }

    // Build per-page stats
    const pageStats = (pages ?? []).map((page) => {
      const pageEvents = eventsByPage[page.id] ?? {}
      const views = pageEvents['view'] ?? 0
      const submissions = pageEvents['form_submit'] ?? 0
      return {
        id: page.id,
        name: page.name,
        slug: page.slug,
        page_order: page.page_order,
        views_count: views,
        submissions_count: submissions,
        conversion_rate: views > 0 ? Math.round((submissions / views) * 10000) / 100 : 0,
      }
    })

    // Aggregate totals
    const totalViews = events.filter((e) => e.event_type === 'view').length
    const totalFormSubmits = events.filter((e) => e.event_type === 'form_submit').length
    const totalButtonClicks = events.filter((e) => e.event_type === 'button_click').length
    const totalVideoPlays = events.filter((e) => e.event_type === 'video_play').length

    // Overall funnel conversion: first page views -> last page views
    const firstPageViews = pageStats.length > 0 ? pageStats[0].views_count : 0
    const lastPageViews = pageStats.length > 0 ? pageStats[pageStats.length - 1].views_count : 0
    const funnelConversionRate =
      firstPageViews > 0
        ? Math.round((lastPageViews / firstPageViews) * 10000) / 100
        : 0

    return NextResponse.json({
      data: {
        period_days: days,
        pages: pageStats,
        totals: {
          views: totalViews,
          form_submits: totalFormSubmits,
          button_clicks: totalButtonClicks,
          video_plays: totalVideoPlays,
        },
        funnel_conversion: {
          first_page_views: firstPageViews,
          last_page_views: lastPageViews,
          conversion_rate: funnelConversionRate,
        },
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
