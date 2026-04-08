import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateBookingSchema } from '@/lib/validations/bookings'
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google/calendar'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { cancelBookingReminders, rescheduleBookingReminders } from '@/lib/bookings/reminders'

const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color), lead:leads(id, first_name, last_name, phone, email), location:booking_locations(id, name, address, location_type)'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateBookingSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data: existing } = await supabase
      .from('bookings')
      .select('id, google_event_id, status, scheduled_at, duration_minutes, call_id, lead_id, calendar_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()
    if (!existing) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    // If cancelling, also clear the meet_url
    const updatePayload = { ...parsed.data } as Record<string, unknown>
    if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
      updatePayload.meet_url = null
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(BOOKING_SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If status changed to cancelled and has a Google event, delete it (non-blocking)
    if (
      parsed.data.status === 'cancelled' &&
      existing.status !== 'cancelled' &&
      existing.google_event_id
    ) {
      deleteGoogleCalendarEvent(workspaceId, existing.google_event_id).catch(() => {})
    }

    // If rescheduled (scheduled_at changed) and has a Google event, update it (non-blocking)
    if (
      parsed.data.scheduled_at &&
      parsed.data.scheduled_at !== existing.scheduled_at &&
      existing.google_event_id &&
      parsed.data.status !== 'cancelled'
    ) {
      const newStart = new Date(parsed.data.scheduled_at)
      const dur = parsed.data.duration_minutes ?? existing.duration_minutes ?? 30
      const newEnd = new Date(newStart.getTime() + dur * 60_000)
      updateGoogleCalendarEvent(workspaceId, existing.google_event_id, {
        start: { dateTime: newStart.toISOString() },
        end: { dateTime: newEnd.toISOString() },
      }).catch(() => {})
    }

    // Cancel reminders if booking cancelled
    if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
      cancelBookingReminders(id).catch((err) => {
        console.error('[booking] Failed to cancel reminders:', err)
      })
    }

    // Cancel reminders if booking is no_show
    if (parsed.data.status === 'no_show' && existing.status !== 'no_show') {
      cancelBookingReminders(id).catch((err) => {
        console.error('[booking] Failed to cancel reminders:', err)
      })
    }

    // Reschedule reminders if booking time changed
    if (
      parsed.data.scheduled_at &&
      parsed.data.scheduled_at !== existing.scheduled_at &&
      parsed.data.status !== 'cancelled' &&
      existing.status !== 'cancelled' &&
      data.lead_id &&
      existing.calendar_id
    ) {
      const leadData = data.lead as { first_name?: string; last_name?: string } | null
      if (leadData) {
        rescheduleBookingReminders({
          workspaceId,
          bookingId: id,
          leadId: data.lead_id,
          newScheduledAt: parsed.data.scheduled_at,
          calendarId: existing.calendar_id,
          lead: { first_name: leadData.first_name ?? '', last_name: leadData.last_name ?? '' },
        }).catch((err) => {
          console.error('[booking] Failed to reschedule reminders:', err)
        })
      }
    }

    // Sync booking status to linked call + create follow-up
    if (existing.call_id && data.lead_id) {
      // Fetch the call to know its type
      const { data: linkedCall } = await supabase
        .from('calls')
        .select('id, type')
        .eq('id', existing.call_id)
        .single()

      if (linkedCall) {
        if (parsed.data.status === 'no_show' && existing.status !== 'no_show') {
          // Call → no_show
          await supabase
            .from('calls')
            .update({ outcome: 'no_show' })
            .eq('id', linkedCall.id)

          // Lead → no_show_setting or no_show_closing
          const noShowStatus = linkedCall.type === 'setting' ? 'no_show_setting' : 'no_show_closing'
          await supabase
            .from('leads')
            .update({ status: noShowStatus })
            .eq('id', data.lead_id)
            .eq('workspace_id', workspaceId)

          // Create follow-up
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0)
          await supabase
            .from('follow_ups')
            .insert({
              workspace_id: workspaceId,
              lead_id: data.lead_id,
              reason: 'No-show RDV — à relancer',
              scheduled_at: tomorrow.toISOString(),
              channel: 'whatsapp',
              status: 'en_attente',
            })

          // Fire call_no_show trigger
          fireTriggersForEvent(workspaceId, 'call_no_show', {
            lead_id: data.lead_id,
            call_id: linkedCall.id,
            call_type: linkedCall.type,
          }).catch(() => {})
        }

        if (parsed.data.status === 'cancelled' && existing.status !== 'cancelled') {
          // Call → cancelled (lead status unchanged)
          await supabase
            .from('calls')
            .update({ outcome: 'cancelled' })
            .eq('id', linkedCall.id)

          // Create follow-up
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0)
          await supabase
            .from('follow_ups')
            .insert({
              workspace_id: workspaceId,
              lead_id: data.lead_id,
              reason: 'RDV annulé — à relancer',
              scheduled_at: tomorrow.toISOString(),
              channel: 'whatsapp',
              status: 'en_attente',
            })
        }
      }
    }

    // Fire workflow trigger when status changes to no_show (non-blocking)
    if (
      parsed.data.status === 'no_show' &&
      existing.status !== 'no_show' &&
      data.lead_id
    ) {
      fireTriggersForEvent(workspaceId, 'booking_no_show', {
        lead_id: data.lead_id,
        booking_id: data.id,
        calendar_id: data.calendar_id,
      }).catch(() => {})
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch the booking first to get google_event_id before deleting
    const { data: bookingToDelete } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!bookingToDelete) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    // Cancel pending reminders before deleting (audit trail preserved)
    cancelBookingReminders(id).catch(() => {})

    const { data, error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    // Delete Google Calendar event if linked (non-blocking)
    if (bookingToDelete.google_event_id) {
      deleteGoogleCalendarEvent(workspaceId, bookingToDelete.google_event_id).catch(() => {})
    }

    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
