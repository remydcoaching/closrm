import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { publicBookingSchema } from '@/lib/validations/bookings'
import { getAvailableSlots } from '@/lib/bookings/availability'
import { startOfMonth, endOfMonth, parseISO, addMinutes } from 'date-fns'

type Params = Promise<{ workspaceSlug: string; calendarSlug: string }>

interface CalendarRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string
  form_fields: unknown
  availability: unknown
  buffer_minutes: number
}

async function getCalendarBySlug(
  workspaceSlug: string,
  calendarSlug: string,
): Promise<CalendarRow | null> {
  const supabase = createServiceClient()

  // 1. Look up workspace_id from slug
  const { data: slugRow, error: slugError } = await supabase
    .from('workspace_slugs')
    .select('workspace_id')
    .eq('slug', workspaceSlug)
    .maybeSingle()

  if (slugError || !slugRow) return null

  // 2. Look up the calendar
  const { data: calendar, error: calError } = await supabase
    .from('booking_calendars')
    .select(
      'id, workspace_id, name, description, duration_minutes, location, color, form_fields, availability, buffer_minutes',
    )
    .eq('workspace_id', slugRow.workspace_id)
    .eq('slug', calendarSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (calError || !calendar) return null

  return calendar as CalendarRow
}

// GET /api/public/book/[workspaceSlug]/[calendarSlug]?month=2026-04
export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { workspaceSlug, calendarSlug } = await params
  const supabase = createServiceClient()

  const calendar = await getCalendarBySlug(workspaceSlug, calendarSlug)
  if (!calendar) {
    return NextResponse.json({ error: 'Calendrier introuvable.' }, { status: 404 })
  }

  // Parse month param (format "2026-04"), default to current month
  const monthParam = request.nextUrl.searchParams.get('month')
  let rangeStart: Date
  let rangeEnd: Date

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const refDate = parseISO(`${monthParam}-01`)
    rangeStart = startOfMonth(refDate)
    rangeEnd = endOfMonth(refDate)
  } else {
    const now = new Date()
    rangeStart = startOfMonth(now)
    rangeEnd = endOfMonth(now)
  }

  // Fetch existing confirmed bookings in that range
  const { data: existingBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('scheduled_at, duration_minutes')
    .eq('workspace_id', calendar.workspace_id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', rangeStart.toISOString())
    .lte('scheduled_at', rangeEnd.toISOString())

  if (bookingsError) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des disponibilités.' }, { status: 500 })
  }

  // Compute available slots
  const slots = getAvailableSlots(
    calendar.availability as Parameters<typeof getAvailableSlots>[0],
    calendar.duration_minutes,
    calendar.buffer_minutes,
    existingBookings ?? [],
    rangeStart,
    rangeEnd,
  )

  // Fetch workspace branding: workspace name + coach owner info
  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', calendar.workspace_id)
    .maybeSingle()

  const { data: ownerRow } = await supabase
    .from('users')
    .select('full_name, avatar_url')
    .eq('workspace_id', calendar.workspace_id)
    .eq('role', 'coach')
    .maybeSingle()

  return NextResponse.json({
    calendar: {
      name: calendar.name,
      description: calendar.description,
      duration_minutes: calendar.duration_minutes,
      location: calendar.location,
      color: calendar.color,
      form_fields: calendar.form_fields,
    },
    workspace: {
      name: workspaceRow?.name ?? null,
      owner_name: ownerRow?.full_name ?? null,
      avatar_url: ownerRow?.avatar_url ?? null,
    },
    slots,
  })
}

// POST /api/public/book/[workspaceSlug]/[calendarSlug]
export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { workspaceSlug, calendarSlug } = await params
  const supabase = createServiceClient()

  const calendar = await getCalendarBySlug(workspaceSlug, calendarSlug)
  if (!calendar) {
    return NextResponse.json({ error: 'Calendrier introuvable.' }, { status: 404 })
  }

  // Parse & validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const parsed = publicBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides.', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { scheduled_at, form_data } = parsed.data

  // Anti-double-booking: check for overlapping confirmed bookings
  const bookingStart = parseISO(scheduled_at)
  const bookingEnd = addMinutes(bookingStart, calendar.duration_minutes)

  const { data: conflicts, error: conflictError } = await supabase
    .from('bookings')
    .select('id, scheduled_at, duration_minutes')
    .eq('workspace_id', calendar.workspace_id)
    .eq('status', 'confirmed')
    .lt('scheduled_at', bookingEnd.toISOString())
    .gte('scheduled_at', addMinutes(bookingStart, -calendar.duration_minutes).toISOString())

  if (conflictError) {
    return NextResponse.json({ error: 'Erreur lors de la vérification de disponibilité.' }, { status: 500 })
  }

  // Fine-grained overlap check
  const hasOverlap = (conflicts ?? []).some((b) => {
    const bStart = parseISO(b.scheduled_at)
    const bEnd = addMinutes(bStart, b.duration_minutes)
    return bookingStart < bEnd && bookingEnd > bStart
  })

  if (hasOverlap) {
    return NextResponse.json({ error: 'Ce créneau n\'est plus disponible.' }, { status: 409 })
  }

  // Find or create lead from form_data
  const email = form_data['email'] ?? null
  const phone = form_data['phone'] ?? null
  const firstName = form_data['first_name'] ?? ''
  const lastName = form_data['last_name'] ?? ''

  let leadId: string | null = null

  // Search by email first, then phone
  if (email) {
    const { data: leadByEmail } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', calendar.workspace_id)
      .eq('email', email)
      .maybeSingle()

    if (leadByEmail) leadId = leadByEmail.id
  }

  if (!leadId && phone) {
    const { data: leadByPhone } = await supabase
      .from('leads')
      .select('id')
      .eq('workspace_id', calendar.workspace_id)
      .eq('phone', phone)
      .maybeSingle()

    if (leadByPhone) leadId = leadByPhone.id
  }

  // Create lead if not found
  if (!leadId) {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        workspace_id: calendar.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: email ?? null,
        phone: phone ?? null,
        source: 'formulaire',
        status: 'nouveau',
      })
      .select('id')
      .single()

    if (leadError || !newLead) {
      return NextResponse.json({ error: 'Erreur lors de la création du lead.' }, { status: 500 })
    }

    leadId = newLead.id
  }

  // Create booking
  const title = `${firstName} ${lastName}`.trim() || 'Réservation'

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      workspace_id: calendar.workspace_id,
      calendar_id: calendar.id,
      lead_id: leadId,
      title,
      scheduled_at,
      duration_minutes: calendar.duration_minutes,
      status: 'confirmed',
      source: 'booking_page',
      form_data,
      is_personal: false,
    })
    .select('id, scheduled_at, duration_minutes, status')
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Erreur lors de la création de la réservation.' }, { status: 500 })
  }

  return NextResponse.json({ booking }, { status: 201 })
}
