import { createServiceClient } from '@/lib/supabase/service'
import type { CalendarReminder } from '@/types'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Compute the send_at datetime for a reminder relative to a booking.
 * Returns null if the computed time is in the past (too late to send).
 */
export function computeSendAt(
  reminder: CalendarReminder,
  bookingScheduledAt: string
): Date | null {
  const bookingDate = parseISO(bookingScheduledAt)

  let sendAt: Date

  // Confirmation (delay 0) = send immediately (now + 1 min buffer)
  if (reminder.delay_value === 0) {
    return new Date(Date.now() + 60 * 1000)
  }

  if (reminder.at_time) {
    // Specific time: X days before at HH:MM (UTC)
    const [hours, minutes] = reminder.at_time.split(':').map(Number)
    const daysToSubtract = reminder.delay_unit === 'days'
      ? reminder.delay_value
      : Math.ceil(reminder.delay_value / 24)
    sendAt = new Date(bookingDate)
    sendAt.setUTCDate(sendAt.getUTCDate() - daysToSubtract)
    sendAt.setUTCHours(hours, minutes, 0, 0)
  } else {
    // Relative: subtract delay from booking time (pure arithmetic, timezone-safe)
    sendAt = new Date(bookingDate)
    if (reminder.delay_unit === 'days') {
      sendAt.setTime(sendAt.getTime() - reminder.delay_value * 24 * 60 * 60 * 1000)
    } else {
      sendAt.setTime(sendAt.getTime() - reminder.delay_value * 60 * 60 * 1000)
    }
  }

  // Don't create if send time is already past
  if (sendAt <= new Date()) return null

  return sendAt
}

/**
 * Resolve template variables in a reminder message.
 */
export function resolveMessage(
  template: string,
  lead: { first_name: string; last_name: string },
  bookingScheduledAt: string,
  calendarName: string
): string {
  const bookingDate = parseISO(bookingScheduledAt)
  const dateStr = format(bookingDate, 'EEEE d MMMM yyyy', { locale: fr })
  const timeStr = format(bookingDate, 'HH:mm')

  return template
    .replace(/\{\{prenom\}\}/g, lead.first_name)
    .replace(/\{\{nom\}\}/g, lead.last_name)
    .replace(/\{\{date_rdv\}\}/g, dateStr)
    .replace(/\{\{heure_rdv\}\}/g, timeStr)
    .replace(/\{\{nom_calendrier\}\}/g, calendarName)
}

/**
 * Create booking_reminders rows for a newly created booking.
 */
export async function createBookingReminders(params: {
  workspaceId: string
  bookingId: string
  leadId: string
  bookingScheduledAt: string
  calendarReminders: CalendarReminder[]
  calendarName: string
  lead: { first_name: string; last_name: string }
}): Promise<number> {
  const { workspaceId, bookingId, leadId, bookingScheduledAt, calendarReminders, calendarName, lead } = params

  if (calendarReminders.length === 0) return 0

  const rows: Array<{
    workspace_id: string
    booking_id: string
    lead_id: string
    channel: string
    message: string
    send_at: string
    status: string
  }> = []

  for (const reminder of calendarReminders) {
    const sendAt = computeSendAt(reminder, bookingScheduledAt)
    if (!sendAt) continue

    const message = resolveMessage(reminder.message, lead, bookingScheduledAt, calendarName)

    rows.push({
      workspace_id: workspaceId,
      booking_id: bookingId,
      lead_id: leadId,
      channel: reminder.channel,
      message,
      send_at: sendAt.toISOString(),
      status: 'pending',
    })
  }

  if (rows.length === 0) return 0

  const supabase = createServiceClient()
  await supabase.from('booking_reminders').insert(rows)

  return rows.length
}

/**
 * Cancel all pending reminders for a booking.
 */
export async function cancelBookingReminders(bookingId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('booking_reminders')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
}

/**
 * Recalculate reminders after a booking is rescheduled.
 */
export async function rescheduleBookingReminders(params: {
  workspaceId: string
  bookingId: string
  leadId: string
  newScheduledAt: string
  calendarId: string
  lead: { first_name: string; last_name: string }
}): Promise<void> {
  const { workspaceId, bookingId, leadId, newScheduledAt, calendarId, lead } = params
  const supabase = createServiceClient()

  // Cancel old pending reminders (not delete — keeps audit trail)
  await supabase
    .from('booking_reminders')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')

  const { data: calendar } = await supabase
    .from('booking_calendars')
    .select('name, reminders')
    .eq('id', calendarId)
    .single()

  if (!calendar) return

  const reminders = (calendar.reminders ?? []) as CalendarReminder[]
  if (reminders.length === 0) return

  await createBookingReminders({
    workspaceId,
    bookingId,
    leadId,
    bookingScheduledAt: newScheduledAt,
    calendarReminders: reminders,
    calendarName: calendar.name,
    lead,
  })
}
