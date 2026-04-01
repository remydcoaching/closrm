import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_EVENT_TYPES = ['view', 'form_submit', 'button_click', 'video_play'] as const

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { funnel_page_id, event_type, visitor_id, metadata } = body

  if (!funnel_page_id || !event_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!VALID_EVENT_TYPES.includes(event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch workspace_id and current counters from the funnel page
  const { data: page, error: pageErr } = await supabase
    .from('funnel_pages')
    .select('workspace_id, views_count, submissions_count')
    .eq('id', funnel_page_id)
    .single()

  if (pageErr || !page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  // Insert event
  const { error: insertErr } = await supabase.from('funnel_events').insert({
    funnel_page_id,
    workspace_id: page.workspace_id,
    event_type,
    visitor_id: visitor_id ?? null,
    metadata: metadata ?? {},
  })

  if (insertErr) {
    console.error('[funnel-events] Insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  // Increment page counters
  if (event_type === 'view') {
    await supabase
      .from('funnel_pages')
      .update({ views_count: (page.views_count ?? 0) + 1 })
      .eq('id', funnel_page_id)
  }

  if (event_type === 'form_submit') {
    await supabase
      .from('funnel_pages')
      .update({ submissions_count: (page.submissions_count ?? 0) + 1 })
      .eq('id', funnel_page_id)
  }

  return NextResponse.json({ ok: true })
}
