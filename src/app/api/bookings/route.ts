import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createBookingSchema, bookingFiltersSchema } from '@/lib/validations/bookings'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { sendBookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'

const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color), lead:leads(id, first_name, last_name, phone, email), location:booking_locations(id, name, address, location_type)'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const filters = bookingFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams))

    let query = supabase
      .from('bookings')
      .select(BOOKING_SELECT, { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (filters.date_start) query = query.gte('scheduled_at', filters.date_start)
    if (filters.date_end) query = query.lte('scheduled_at', filters.date_end)
    if (filters.calendar_id) query = query.eq('calendar_id', filters.calendar_id)
    if (filters.status) query = query.eq('status', filters.status)

    query = query.order('scheduled_at', { ascending: true })

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data: data ?? [],
      meta: {
        total: count ?? 0,
        page: filters.page,
        per_page: filters.per_page,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createBookingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id: workspaceId,
        calendar_id: parsed.data.calendar_id ?? null,
        lead_id: parsed.data.lead_id ?? null,
        title: parsed.data.title,
        scheduled_at: parsed.data.scheduled_at,
        duration_minutes: parsed.data.duration_minutes,
        notes: parsed.data.notes ?? null,
        is_personal: parsed.data.is_personal,
        location_id: parsed.data.location_id ?? null,
        source: 'manual',
      })
      .select(BOOKING_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fire workflow triggers (non-blocking)
    if (data.lead_id) {
      fireTriggersForEvent(workspaceId, 'booking_created', {
        lead_id: data.lead_id,
        booking_id: data.id,
        calendar_id: data.calendar_id,
        calendar_name: (data.booking_calendar as { name?: string } | null)?.name,
        scheduled_at: data.scheduled_at,
      }).catch(() => {})
    }

    // Create Google Calendar event (non-blocking)
    // Determine if the location is online to attach Google Meet
    let isOnlineLocation = false
    let locationName: string | null = null
    let locationAddress: string | null = null
    if (parsed.data.location_id) {
      const { data: loc } = await supabase
        .from('booking_locations')
        .select('location_type, name, address')
        .eq('id', parsed.data.location_id)
        .eq('workspace_id', workspaceId)
        .single()
      if (loc) {
        if (loc.location_type === 'online') isOnlineLocation = true
        locationName = loc.name
        locationAddress = loc.address
      }
    }

    const scheduledAt = new Date(data.scheduled_at)
    const endAt = new Date(scheduledAt.getTime() + (data.duration_minutes ?? 30) * 60_000)
    createGoogleCalendarEvent(
      workspaceId,
      {
        summary: data.title,
        description: data.notes ?? undefined,
        start: { dateTime: scheduledAt.toISOString() },
        end: { dateTime: endAt.toISOString() },
      },
      { withMeet: isOnlineLocation && !locationAddress },
    )
      .then(async (result) => {
        if (result?.eventId) {
          const supa = await createClient()
          await supa
            .from('bookings')
            .update({
              google_event_id: result.eventId,
              ...(result.meetUrl ? { meet_url: result.meetUrl } : {}),
            })
            .eq('id', data.id)
            .eq('workspace_id', workspaceId)
        }

        // Send confirmation email to lead if they have an email
        const leadEmail = (data.lead as { email?: string | null } | null)?.email
        if (leadEmail) {
          const leadFirst = (data.lead as { first_name?: string } | null)?.first_name ?? ''
          const leadLast = (data.lead as { last_name?: string } | null)?.last_name ?? ''
          const supa2 = await createClient()
          const { data: owner } = await supa2
            .from('users')
            .select('full_name')
            .eq('workspace_id', workspaceId)
            .eq('role', 'coach')
            .maybeSingle()

          sendBookingConfirmationEmail({
            to: leadEmail,
            coachName: owner?.full_name ?? 'Votre coach',
            prospectName: `${leadFirst} ${leadLast}`.trim(),
            date: scheduledAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            time: scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            meetUrl: result?.meetUrl ?? undefined,
            locationName: locationName ?? undefined,
            locationAddress: locationAddress ?? undefined,
          }).catch(() => {})
        }
      })
      .catch(() => {})

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
