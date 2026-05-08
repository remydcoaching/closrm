import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateBookingSchema } from '@/lib/validations/bookings'
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/google/calendar'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { cancelBookingReminders, rescheduleBookingReminders } from '@/lib/bookings/reminders'
import { sendBookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { buildCalendarUrls } from '@/lib/email/calendar-links'
import { formatBookingDateFR, formatBookingTimeFR } from '@/lib/bookings/format'

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
    const { notify_lead: shouldNotify, ...updateFields } = parsed.data
    const updatePayload = { ...updateFields } as Record<string, unknown>
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

    // Send notification email to lead if coach requested it
    if (
      shouldNotify &&
      parsed.data.scheduled_at &&
      parsed.data.scheduled_at !== existing.scheduled_at &&
      data.lead_id
    ) {
      const leadData = data.lead as { first_name?: string; last_name?: string; email?: string } | null
      if (leadData?.email) {
        const newDt = new Date(parsed.data.scheduled_at)
        const { data: owner } = await supabase.from('users').select('full_name').eq('workspace_id', workspaceId).eq('role', 'coach').maybeSingle()
        const { data: cal } = data.calendar_id
          ? await supabase.from('booking_calendars').select('name, email_template, email_accent_color').eq('id', data.calendar_id).maybeSingle()
          : { data: null }
        const coachName = owner?.full_name ?? 'Votre coach'
        const calName = (cal as { name?: string } | null)?.name ?? 'Coaching'
        const calTemplate = (cal as { email_template?: 'premium' | 'minimal' | 'plain' } | null)?.email_template ?? 'premium'
        const calAccent = (cal as { email_accent_color?: string } | null)?.email_accent_color ?? '#E53E3E'
        const calendarLinks = buildCalendarUrls({
          title: `RDV ${calName} — ${coachName}`,
          startISO: newDt.toISOString(),
          durationMinutes: data.duration_minutes ?? 30,
          description: `Rendez-vous ${calName} avec ${coachName}`,
        })
        const manageToken = (data as unknown as { manage_token?: string }).manage_token
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const manageUrl = appUrl && manageToken ? `${appUrl}/booking/manage/${data.id}?token=${manageToken}` : undefined
        sendBookingConfirmationEmail({
          to: leadData.email,
          workspaceId,
          coachName,
          prospectName: `${leadData.first_name ?? ''} ${leadData.last_name ?? ''}`.trim(),
          date: formatBookingDateFR(newDt),
          time: formatBookingTimeFR(newDt),
          template: calTemplate,
          accentColor: calAccent,
          manageUrl,
          icsUrl: calendarLinks.icsUrl,
          googleCalendarUrl: calendarLinks.googleCalendarUrl,
        }).catch((err) => console.error('[booking] Reschedule notification email failed:', err))
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // ── Scope de suppression pour les séries récurrentes ──
    //  this   (default) : seul ce booking
    //  future : ce booking + toutes les occurrences ultérieures du même groupe
    //  all    : toute la série
    const scopeRaw = request.nextUrl.searchParams.get('scope') ?? 'this'
    const scope = (['this', 'future', 'all'] as const).includes(scopeRaw as never)
      ? (scopeRaw as 'this' | 'future' | 'all')
      : 'this'

    const { data: bookingToDelete } = await supabase
      .from('bookings')
      .select('id, google_event_id, recurrence_group_id, scheduled_at')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!bookingToDelete) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })

    // Si scope != 'this' mais le booking n'a pas de série, on retombe sur 'this'
    const effectiveScope = bookingToDelete.recurrence_group_id ? scope : 'this'

    if (effectiveScope === 'this') {
      cancelBookingReminders(id).catch(() => {})
      // Fetch call_id before deleting the booking
      const { data: bookingWithCall } = await supabase
        .from('bookings')
        .select('call_id')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()
      const { data, error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()
      if (error || !data) return NextResponse.json({ error: 'Réservation non trouvée' }, { status: 404 })
      if (bookingToDelete.google_event_id) {
        deleteGoogleCalendarEvent(workspaceId, bookingToDelete.google_event_id).catch(() => {})
      }
      if (bookingWithCall?.call_id) {
        supabase.from('calls').delete().eq('id', bookingWithCall.call_id).eq('workspace_id', workspaceId).then(() => {})
      }
      return NextResponse.json({ data, deleted_count: 1 })
    }

    // Récupère toutes les occurrences à supprimer
    const groupId = bookingToDelete.recurrence_group_id as string
    let toDeleteQuery = supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('workspace_id', workspaceId)
      .eq('recurrence_group_id', groupId)
    if (effectiveScope === 'future') {
      toDeleteQuery = toDeleteQuery.gte('scheduled_at', bookingToDelete.scheduled_at)
    }
    const { data: toDelete, error: fetchErr } = await toDeleteQuery
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const ids = (toDelete ?? []).map((r) => r.id)
    if (ids.length === 0) return NextResponse.json({ data: null, deleted_count: 0 })

    // Cancel reminders pour chacun (best-effort)
    for (const rid of ids) cancelBookingReminders(rid).catch(() => {})

    const { error: delErr } = await supabase
      .from('bookings')
      .delete()
      .in('id', ids)
      .eq('workspace_id', workspaceId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Cleanup Google Calendar (non-blocking)
    for (const r of toDelete ?? []) {
      if (r.google_event_id) {
        deleteGoogleCalendarEvent(workspaceId, r.google_event_id).catch(() => {})
      }
    }

    return NextResponse.json({ deleted_count: ids.length, scope: effectiveScope })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
