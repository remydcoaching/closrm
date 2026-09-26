// Lead journey (bookings, funnel events, Instagram gestures with content
// thumbnails, first/last attribution touch). Shared by GET
// /api/leads/:id/journey (web) and the desktop lead intelligence endpoint.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface JourneyEvent {
  id: string
  event_type: string
  metadata: Record<string, unknown>
  funnel_page_id: string | null
  funnel_page_name: string | null
  created_at: string
}

export interface AttributionTouch {
  source: string | null
  value: string | null
  at: string | null
  raw: Record<string, unknown> | null
}

export interface JourneyBooking {
  id: string
  scheduled_at: string
  status: string
  duration_minutes: number
  form_data: Record<string, unknown>
  calendar_id: string | null
  calendar_name: string | null
}

const ATTRIBUTION_KEYS = ['fbclid', 'gclid', 'ttclid', 'msclkid', 'utm_campaign', 'utm_source', 'campaign_id', 'ad_id'] as const

function pickTouch(metadata: Record<string, unknown> | null | undefined): { source: string; value: string } | null {
  if (!metadata) return null
  for (const key of ATTRIBUTION_KEYS) {
    const v = metadata[key]
    if (typeof v === 'string' && v) return { source: key, value: v }
  }
  return null
}

export async function loadLeadJourney(supabase: SupabaseClient, workspaceId: string, id: string) {
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, first_name, last_name, source, visitor_id, form_answers, meta_campaign_id, meta_adset_id, meta_ad_id, notes, created_at')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (leadErr || !lead) return null

  // 2. Bookings for this lead (with calendar name)
  // Independent reads, run together.
  const [{ data: bookingsRaw }, { data: eventsRawAll }, { data: igInteractions }] = await Promise.all([
    supabase
    .from('bookings')
    .select('id, scheduled_at, status, duration_minutes, form_data, calendar_id, booking_calendars(name)')
    .eq('lead_id', id)
    .eq('workspace_id', workspaceId)
    .order('scheduled_at', { ascending: true }),
    lead.visitor_id
      ? supabase
          .from('funnel_events')
          .select('id, event_type, metadata, funnel_page_id, created_at, funnel_pages(name)')
          .eq('workspace_id', workspaceId)
          .eq('visitor_id', lead.visitor_id)
          .order('created_at', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('instagram_interactions')
      .select('id, interaction_type, instagram_username, profile_url, source_post_id, source_post_url, metadata, last_seen_at')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', id)
      .order('last_seen_at', { ascending: true })
      .limit(200),
  ])

  const bookings: JourneyBooking[] = (bookingsRaw ?? []).map((b) => {
    const cal = b.booking_calendars as { name: string } | { name: string }[] | null
    const calName = Array.isArray(cal) ? cal[0]?.name ?? null : cal?.name ?? null
    return {
      id: b.id as string,
      scheduled_at: b.scheduled_at as string,
      status: b.status as string,
      duration_minutes: b.duration_minutes as number,
      form_data: (b.form_data ?? {}) as Record<string, unknown>,
      calendar_id: (b.calendar_id ?? null) as string | null,
      calendar_name: calName,
    }
  })

  // 3. Funnel events for this visitor (if any)
  let events: JourneyEvent[] = []
  {
    const eventsRaw = eventsRawAll
    events = (eventsRaw ?? []).map((e) => {
      const page = e.funnel_pages as { name: string } | { name: string }[] | null
      const pageName = Array.isArray(page) ? page[0]?.name ?? null : page?.name ?? null
      return {
        id: e.id as string,
        event_type: e.event_type as string,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        funnel_page_id: (e.funnel_page_id ?? null) as string | null,
        funnel_page_name: pageName,
        created_at: e.created_at as string,
      }
    })
  }

  // 4. Instagram engagement events for this lead — instagram_like,
  // instagram_comment, instagram_dm, instagram_mention, instagram_story_view
  // Visual of the story / post each gesture was on (stories collected by
  // the desktop app, contents from Ciblage scans) — shown in the journey.
  const postIds = [...new Set((igInteractions ?? []).map((ig) => ig.source_post_id as string | null).filter((id): id is string => !!id))]
  const thumbs = new Map<string, { url: string | null; kind: 'story' | 'reel' | 'post'; publishedAt: string | null }>()
  if (postIds.length > 0) {
    const [{ data: storyRows }, { data: contentRows }] = await Promise.all([
      supabase.from('story_view_stories').select('story_pk, thumbnail_url, taken_at').eq('workspace_id', workspaceId).in('story_pk', postIds),
      supabase.from('discovery_contents').select('content_id, thumbnail_url, content_type, published_at, created_at').eq('workspace_id', workspaceId).in('content_id', postIds),
    ])
    for (const c of contentRows ?? []) thumbs.set(c.content_id, { url: c.thumbnail_url, kind: c.content_type === 'clip' ? 'reel' : 'post', publishedAt: c.published_at })
    for (const st of storyRows ?? []) thumbs.set(st.story_pk, { url: st.thumbnail_url, kind: 'story', publishedAt: st.taken_at })
  }

  const igEvents: JourneyEvent[] = (igInteractions ?? []).map((ig) => ({
    id: ig.id as string,
    event_type: `instagram_${ig.interaction_type}`,
    metadata: {
      ...(ig.metadata as Record<string, unknown> ?? {}),
      instagram_username: ig.instagram_username,
      source_post_url: ig.source_post_url,
      source_post_id: ig.source_post_id,
      content_thumbnail_url: ig.source_post_id ? (thumbs.get(ig.source_post_id as string)?.url ?? null) : null,
      content_kind: ig.source_post_id ? (thumbs.get(ig.source_post_id as string)?.kind ?? null) : null,
      content_published_at: ig.source_post_id ? (thumbs.get(ig.source_post_id as string)?.publishedAt ?? null) : null,
    },
    funnel_page_id: null,
    funnel_page_name: null,
    created_at: ig.last_seen_at as string,
  }))

  events = [...events, ...igEvents].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // 5. Derive first / last attribution touches
  const firstTouchEvent = events.find((e) => pickTouch(e.metadata))
  const lastTouchEvent = [...events].reverse().find((e) => pickTouch(e.metadata))

  const firstTouch: AttributionTouch = firstTouchEvent
    ? (() => {
        const picked = pickTouch(firstTouchEvent.metadata)!
        return {
          source: picked.source,
          value: picked.value,
          at: firstTouchEvent.created_at,
          raw: firstTouchEvent.metadata,
        }
      })()
    : lead.meta_ad_id || lead.meta_campaign_id
      ? {
          source: lead.meta_ad_id ? 'meta_ad_id' : 'meta_campaign_id',
          value: (lead.meta_ad_id ?? lead.meta_campaign_id) as string,
          at: lead.created_at as string,
          raw: null,
        }
      : { source: null, value: null, at: null, raw: null }

  const lastTouch: AttributionTouch = lastTouchEvent
    ? (() => {
        const picked = pickTouch(lastTouchEvent.metadata)!
        return {
          source: picked.source,
          value: picked.value,
          at: lastTouchEvent.created_at,
          raw: lastTouchEvent.metadata,
        }
      })()
    : firstTouch

  return {
    data: {
      lead: {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        source: lead.source,
        visitor_id: lead.visitor_id,
        form_answers: lead.form_answers ?? {},
        meta_campaign_id: lead.meta_campaign_id,
        meta_adset_id: lead.meta_adset_id,
        meta_ad_id: lead.meta_ad_id,
        created_at: lead.created_at,
      },
      bookings,
      events,
      attribution: { first_touch: firstTouch, last_touch: lastTouch },
    },
  }.data
}
