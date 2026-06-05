import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface JourneyEvent {
  id: string
  event_type: string
  metadata: Record<string, unknown>
  funnel_page_id: string | null
  funnel_page_name: string | null
  created_at: string
}

interface AttributionTouch {
  source: string | null
  value: string | null
  at: string | null
  raw: Record<string, unknown> | null
}

interface JourneyBooking {
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // 1. Lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, first_name, last_name, source, visitor_id, form_answers, meta_campaign_id, meta_adset_id, meta_ad_id, notes, created_at')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    // 2. Bookings for this lead (with calendar name)
    const { data: bookingsRaw } = await supabase
      .from('bookings')
      .select('id, scheduled_at, status, duration_minutes, form_data, calendar_id, booking_calendars(name)')
      .eq('lead_id', id)
      .eq('workspace_id', workspaceId)
      .order('scheduled_at', { ascending: true })

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
    if (lead.visitor_id) {
      const { data: eventsRaw } = await supabase
        .from('funnel_events')
        .select('id, event_type, metadata, funnel_page_id, created_at, funnel_pages(name)')
        .eq('workspace_id', workspaceId)
        .eq('visitor_id', lead.visitor_id)
        .order('created_at', { ascending: true })
        .limit(200)

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

    // 4. Derive first / last attribution touches
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

    return NextResponse.json({
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
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[journey] error', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
