import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createBookingSchema, bookingFiltersSchema } from '@/lib/validations/bookings'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'

const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color, location), lead:leads(id, first_name, last_name, phone, email)'

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
        calendar_name: (data.booking_calendar as { name?: string } | null)?.name,
        scheduled_at: data.scheduled_at,
      }).catch(() => {})
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
