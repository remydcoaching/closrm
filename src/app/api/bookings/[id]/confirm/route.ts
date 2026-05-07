import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { sendBookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { buildCalendarUrls } from '@/lib/email/calendar-links'
import { createBookingReminders } from '@/lib/bookings/reminders'
import { formatBookingDateFR, formatBookingTimeFR } from '@/lib/bookings/format'
import { updateGoogleCalendarEvent } from '@/lib/google/calendar'
import type { CalendarReminder } from '@/types'

type Params = Promise<{ id: string }>

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params

  let workspaceId: string
  try {
    ;({ workspaceId } = await getWorkspaceId())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, scheduled_at, duration_minutes, lead_id, calendar_id, google_event_id, meet_url, manage_token, title, location_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Booking non trouvé.' }, { status: 404 })
  }

  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Ce RDV n\'est pas en attente de confirmation.' }, { status: 400 })
  }

  // Update status to confirmed
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (updateErr) {
    return NextResponse.json({ error: 'Erreur lors de la confirmation.' }, { status: 500 })
  }

  // Update Google Calendar event: remove [À confirmer] prefix, set status confirmed
  if (booking.google_event_id) {
    const cleanTitle = (booking.title ?? '').replace(/^\[À confirmer\]\s*/, '')
    updateGoogleCalendarEvent(workspaceId, booking.google_event_id, {
      summary: cleanTitle || booking.title,
      status: 'confirmed',
    }).catch((err) => {
      console.error('[confirm-booking] Google Calendar update failed:', err instanceof Error ? err.message : err)
    })
  }

  // Fetch calendar config + lead info for email/reminders
  const [{ data: cal }, { data: lead }, { data: owner }] = await Promise.all([
    supabase.from('booking_calendars').select('name, email_template, email_accent_color, reminders').eq('id', booking.calendar_id).maybeSingle(),
    booking.lead_id
      ? supabase.from('leads').select('id, first_name, last_name, email, phone').eq('id', booking.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('users').select('full_name').eq('workspace_id', workspaceId).eq('role', 'coach').maybeSingle(),
  ])

  const calName = cal?.name ?? ''
  const calTemplate = (cal as { email_template?: 'premium' | 'minimal' | 'plain' } | null)?.email_template ?? 'premium'
  const calAccent = (cal as { email_accent_color?: string } | null)?.email_accent_color ?? '#E53E3E'
  const calReminders = (cal?.reminders ?? []) as CalendarReminder[]

  // Create booking reminders
  if (lead && calReminders.length > 0) {
    createBookingReminders({
      workspaceId,
      bookingId: booking.id,
      leadId: lead.id,
      bookingScheduledAt: booking.scheduled_at,
      calendarReminders: calReminders,
      calendarName: calName,
      lead: { first_name: lead.first_name ?? '', last_name: lead.last_name ?? '' },
    }).catch((err) => {
      console.error('[confirm-booking] Failed to create reminders:', err)
    })
  }

  // Send confirmation email to the lead
  if (lead?.email) {
    const scheduledAt = new Date(booking.scheduled_at)
    const dateStr = formatBookingDateFR(scheduledAt)
    const timeStr = formatBookingTimeFR(scheduledAt)
    const firstName = lead.first_name ?? ''
    const lastName = lead.last_name ?? ''
    const coachFullName = owner?.full_name ?? 'Votre coach'

    const emailConfirmationReminder = calReminders.find(
      (r) => r.channel === 'email' && r.delay_value === 0,
    )
    const customMessage = emailConfirmationReminder
      ? emailConfirmationReminder.message
          .replace(/\{\{prenom\}\}/g, firstName)
          .replace(/\{\{nom\}\}/g, lastName)
          .replace(/\{\{date_rdv\}\}/g, dateStr)
          .replace(/\{\{heure_rdv\}\}/g, timeStr)
          .replace(/\{\{nom_calendrier\}\}/g, calName)
      : undefined

    // Fetch location info
    let locationName: string | undefined
    let locationAddress: string | undefined
    if (booking.location_id) {
      const { data: loc } = await supabase
        .from('booking_locations')
        .select('name, address')
        .eq('id', booking.location_id)
        .maybeSingle()
      if (loc) {
        locationName = loc.name ?? undefined
        locationAddress = loc.address ?? undefined
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const manageUrl = appUrl && booking.manage_token
      ? `${appUrl}/booking/manage/${booking.id}?token=${booking.manage_token}`
      : undefined

    const calLocation = booking.meet_url ? 'Google Meet' : locationName && locationAddress ? `${locationName}, ${locationAddress}` : locationName ?? ''
    const calendarLinks = buildCalendarUrls({
      title: `RDV ${calName || 'Coaching'} — ${coachFullName}`,
      startISO: booking.scheduled_at,
      durationMinutes: booking.duration_minutes,
      location: calLocation,
      description: `Rendez-vous ${calName || 'Coaching'} avec ${coachFullName}`,
    })

    sendBookingConfirmationEmail({
      to: lead.email,
      workspaceId,
      coachName: coachFullName,
      prospectName: `${firstName} ${lastName}`.trim(),
      date: dateStr,
      time: timeStr,
      meetUrl: booking.meet_url ?? undefined,
      locationName,
      locationAddress,
      isPhoneCall: locationName === 'Téléphone',
      template: calTemplate,
      accentColor: calAccent,
      customMessage,
      manageUrl,
      icsUrl: calendarLinks.icsUrl,
      googleCalendarUrl: calendarLinks.googleCalendarUrl,
    }).catch((err) => {
      console.error('[confirm-booking] Email failed:', err instanceof Error ? err.message : err)
    })
  }

  return NextResponse.json({ ok: true })
}
