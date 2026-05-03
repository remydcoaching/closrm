/**
 * A-028a-01 — API publique de booking par calendar UUID.
 *
 * Même logique que /api/public/book/[workspaceSlug]/[calendarSlug] mais
 * lookup par UUID au lieu de slugs. Utilisé par le BookingBlock des funnels
 * qui ne connaît que le `calendarId` (pas les slugs).
 *
 * GET  ?month=YYYY-MM → calendar info + slots disponibles
 * POST { scheduled_at, form_data, location_id? } → crée booking + lead
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { publicBookingSchema } from '@/lib/validations/bookings'
import { getAvailableSlots } from '@/lib/bookings/availability'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { sendBookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { createBookingReminders } from '@/lib/bookings/reminders'
import { formatBookingDateFR, formatBookingTimeFR } from '@/lib/bookings/format'
import type { CalendarReminder } from '@/types'
import { startOfMonth, endOfMonth, parseISO, addMinutes } from 'date-fns'

type Params = Promise<{ calendarId: string }>

interface CalendarRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  duration_minutes: number
  location_ids: string[]
  color: string
  form_fields: unknown
  availability: unknown
  buffer_minutes: number
  purpose: string
  reminders: unknown[]
  max_advance_days: number | null
}

async function getCalendarById(calendarId: string): Promise<CalendarRow | null> {
  const supabase = createServiceClient()

  const { data: calendar, error } = await supabase
    .from('booking_calendars')
    .select(
      'id, workspace_id, name, description, duration_minutes, location_ids, color, form_fields, availability, buffer_minutes, purpose, reminders, max_advance_days',
    )
    .eq('id', calendarId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !calendar) return null
  return calendar as CalendarRow
}

// GET /api/public/booking/[calendarId]?month=2026-04
export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { calendarId } = await params
  const supabase = createServiceClient()

  const calendar = await getCalendarById(calendarId)
  if (!calendar) {
    return NextResponse.json({ error: 'Calendrier introuvable.' }, { status: 404 })
  }

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

  // Enforce booking horizon: cap the visible range at now + max_advance_days
  if (calendar.max_advance_days != null) {
    const horizon = new Date()
    horizon.setHours(23, 59, 59, 999)
    horizon.setDate(horizon.getDate() + calendar.max_advance_days)
    if (rangeEnd > horizon) rangeEnd = horizon
    // If the entire requested month is past the horizon, return empty slots
    if (rangeStart > horizon) {
      return NextResponse.json({
        calendar: {
          name: calendar.name,
          description: calendar.description,
          duration_minutes: calendar.duration_minutes,
          location_ids: calendar.location_ids,
          color: calendar.color,
          form_fields: calendar.form_fields,
          max_advance_days: calendar.max_advance_days,
        },
        locations: [],
        slots: [],
      })
    }
  }

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

  const slots = getAvailableSlots(
    calendar.availability as Parameters<typeof getAvailableSlots>[0],
    calendar.duration_minutes,
    calendar.buffer_minutes,
    existingBookings ?? [],
    rangeStart,
    rangeEnd,
  )

  // Fetch locations
  let locationsList: { id: string; name: string; address: string | null; location_type: string }[] = []
  if (calendar.location_ids && calendar.location_ids.length > 0) {
    const { data: locs } = await supabase
      .from('booking_locations')
      .select('id, name, address, location_type')
      .in('id', calendar.location_ids)
      .eq('is_active', true)

    locationsList = locs ?? []
  }

  return NextResponse.json({
    calendar: {
      name: calendar.name,
      description: calendar.description,
      duration_minutes: calendar.duration_minutes,
      location_ids: calendar.location_ids,
      color: calendar.color,
      form_fields: calendar.form_fields,
      max_advance_days: calendar.max_advance_days,
    },
    locations: locationsList,
    slots,
  })
}

// POST /api/public/booking/[calendarId]
export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { calendarId } = await params
  const supabase = createServiceClient()

  const calendar = await getCalendarById(calendarId)
  if (!calendar) {
    return NextResponse.json({ error: 'Calendrier introuvable.' }, { status: 404 })
  }

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

  const { scheduled_at, form_data, location_id } = parsed.data

  // Anti-double-booking
  const bookingStart = parseISO(scheduled_at)
  const bookingEnd = addMinutes(bookingStart, calendar.duration_minutes)

  // Enforce booking horizon
  if (calendar.max_advance_days != null) {
    const horizon = new Date()
    horizon.setHours(23, 59, 59, 999)
    horizon.setDate(horizon.getDate() + calendar.max_advance_days)
    if (bookingStart > horizon) {
      return NextResponse.json(
        { error: `Vous ne pouvez réserver qu'à maximum ${calendar.max_advance_days} jour${calendar.max_advance_days > 1 ? 's' : ''} d'avance.` },
        { status: 400 },
      )
    }
  }

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

  const hasOverlap = (conflicts ?? []).some((b) => {
    const bStart = parseISO(b.scheduled_at)
    const bEnd = addMinutes(bStart, b.duration_minutes)
    return bookingStart < bEnd && bookingEnd > bStart
  })

  if (hasOverlap) {
    return NextResponse.json({ error: 'Ce créneau n\'est plus disponible.' }, { status: 409 })
  }

  // Find or create lead
  const email = form_data['email'] ?? null
  const phone = form_data['phone'] ?? null
  const firstName = form_data['first_name'] ?? ''
  const lastName = form_data['last_name'] ?? ''

  let leadId: string | null = null

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

  if (!leadId) {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        workspace_id: calendar.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: email ?? null,
        phone: phone ?? null,
        source: 'funnel',
        status: 'nouveau',
        tags: ['funnel:booking'],
      })
      .select('id')
      .single()

    if (leadError || !newLead) {
      return NextResponse.json({ error: 'Erreur lors de la création du lead.' }, { status: 500 })
    }
    leadId = newLead.id

    // Fire new_lead trigger
    fireTriggersForEvent(calendar.workspace_id, 'new_lead', {
      lead_id: newLead.id,
      source: 'funnel',
    }).catch(() => {})
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
      source: 'funnel',
      form_data,
      is_personal: false,
      location_id: location_id ?? null,
    })
    .select('id, scheduled_at, duration_minutes, status, manage_token')
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Erreur lors de la création de la réservation.' }, { status: 500 })
  }

  // Auto-create call if calendar has purpose setting/closing
  if (leadId && (calendar.purpose === 'setting' || calendar.purpose === 'closing')) {
    const { count: callCount } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', calendar.workspace_id)
      .eq('lead_id', leadId)
      .eq('type', calendar.purpose)

    const { data: newCall } = await supabase
      .from('calls')
      .insert({
        workspace_id: calendar.workspace_id,
        lead_id: leadId,
        type: calendar.purpose,
        scheduled_at,
        outcome: 'pending',
        attempt_number: (callCount ?? 0) + 1,
        reached: false,
        notes: `Via funnel — calendrier : ${calendar.name}`,
      })
      .select('id')
      .single()

    if (newCall) {
      await supabase
        .from('bookings')
        .update({ call_id: newCall.id })
        .eq('id', booking.id)

      const newStatus = calendar.purpose === 'setting' ? 'setting_planifie' : 'closing_planifie'
      await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId)
        .eq('workspace_id', calendar.workspace_id)

      fireTriggersForEvent(calendar.workspace_id, 'call_scheduled', {
        lead_id: leadId,
        call_id: newCall.id,
        call_type: calendar.purpose,
      }).catch(() => {})
    }
  }

  // Reminders
  if (leadId && calendar.reminders && calendar.reminders.length > 0) {
    createBookingReminders({
      workspaceId: calendar.workspace_id,
      bookingId: booking.id,
      leadId,
      bookingScheduledAt: scheduled_at,
      calendarReminders: calendar.reminders as CalendarReminder[],
      calendarName: calendar.name,
      lead: { first_name: firstName, last_name: lastName },
    }).catch((err) => {
      console.error('[public-booking-by-id] Failed to create reminders:', err)
    })
  }

  // Workflow trigger
  if (leadId) {
    fireTriggersForEvent(calendar.workspace_id, 'booking_created', {
      lead_id: leadId,
      booking_id: booking.id,
      calendar_id: calendar.id,
      calendar_name: calendar.name,
      scheduled_at: booking.scheduled_at,
    }).catch(() => {})
  }

  // Google Calendar event
  let isOnlineLocation = false
  let locationName: string | null = null
  let locationAddress: string | null = null
  if (location_id) {
    const { data: loc } = await supabase
      .from('booking_locations')
      .select('location_type, name, address')
      .eq('id', location_id)
      .eq('workspace_id', calendar.workspace_id)
      .single()
    if (loc) {
      isOnlineLocation = loc.location_type === 'online'
      locationName = loc.name
      locationAddress = loc.address
    }
  } else if (calendar.location_ids && calendar.location_ids.length > 0) {
    const { data: locs } = await supabase
      .from('booking_locations')
      .select('location_type, name, address')
      .in('id', calendar.location_ids)
      .eq('workspace_id', calendar.workspace_id)
    const onlineLoc = locs?.find(l => l.location_type === 'online')
    if (onlineLoc) {
      isOnlineLocation = true
      locationName = onlineLoc.name
      locationAddress = onlineLoc.address
    }
  }

  const bookingStartDt = new Date(booking.scheduled_at)
  const bookingEndDt = addMinutes(bookingStartDt, booking.duration_minutes)
  const withMeet = isOnlineLocation && !locationAddress

  // Schedule GCal event creation + confirmation email after the response,
  // so the serverless function isn't terminated mid-flight.
  after(async () => {
    let meetUrl: string | undefined

    try {
      const result = await createGoogleCalendarEvent(
        calendar.workspace_id,
        {
          summary: title,
          start: { dateTime: bookingStartDt.toISOString() },
          end: { dateTime: bookingEndDt.toISOString() },
        },
        { withMeet },
      )
      if (result?.eventId) {
        meetUrl = result.meetUrl ?? undefined
        await supabase
          .from('bookings')
          .update({
            google_event_id: result.eventId,
            ...(result.meetUrl ? { meet_url: result.meetUrl } : {}),
          })
          .eq('id', booking.id)
          .eq('workspace_id', calendar.workspace_id)
      }
    } catch (err) {
      console.error('[public-booking-by-id] Google Calendar event creation failed:', err instanceof Error ? err.message : err)
    }

    const emailConfirmationReminder = (calendar.reminders as CalendarReminder[] | undefined)?.find(
      (r) => r.channel === 'email' && r.delay_value === 0,
    )

    if (email) {
      try {
        const [ownerRes, calRes] = await Promise.all([
          supabase.from('users').select('full_name').eq('workspace_id', calendar.workspace_id).eq('role', 'coach').maybeSingle(),
          supabase.from('booking_calendars').select('email_template, email_accent_color, name').eq('id', calendar.id).maybeSingle(),
        ])
        const calTemplate = (calRes.data as { email_template?: 'premium' | 'minimal' | 'plain' } | null)?.email_template ?? 'premium'
        const calAccent = (calRes.data as { email_accent_color?: string } | null)?.email_accent_color ?? '#E53E3E'
        const calName = (calRes.data as { name?: string } | null)?.name ?? ''

        const dateStr = formatBookingDateFR(bookingStartDt)
        const timeStr = formatBookingTimeFR(bookingStartDt)

        const customMessage = emailConfirmationReminder
          ? emailConfirmationReminder.message
              .replace(/\{\{prenom\}\}/g, firstName)
              .replace(/\{\{nom\}\}/g, lastName)
              .replace(/\{\{date_rdv\}\}/g, dateStr)
              .replace(/\{\{heure_rdv\}\}/g, timeStr)
              .replace(/\{\{nom_calendrier\}\}/g, calName)
          : undefined

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const manageToken = (booking as unknown as { manage_token?: string }).manage_token
        const manageUrl = appUrl && manageToken
          ? `${appUrl}/booking/manage/${booking.id}?token=${manageToken}`
          : undefined

        await sendBookingConfirmationEmail({
          to: email,
          workspaceId: calendar.workspace_id,
          coachName: ownerRes.data?.full_name ?? 'Votre coach',
          prospectName: `${firstName} ${lastName}`.trim(),
          date: dateStr,
          time: timeStr,
          meetUrl,
          locationName: locationName ?? undefined,
          locationAddress: locationAddress ?? undefined,
          isPhoneCall: locationName === 'Téléphone',
          template: calTemplate,
          accentColor: calAccent,
          customMessage,
          manageUrl,
        })
      } catch (err) {
        console.error('[public-booking-by-id] booking-confirmation email failed:', err instanceof Error ? err.message : err)
      }
    }
  })

  return NextResponse.json({ booking }, { status: 201 })
}
