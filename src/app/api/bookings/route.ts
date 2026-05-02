import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createBookingSchema, bookingFiltersSchema } from '@/lib/validations/bookings'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import { sendBookingConfirmationEmail } from '@/lib/email/templates/booking-confirmation'
import { createBookingReminders } from '@/lib/bookings/reminders'
import type { CalendarReminder } from '@/types'

const BOOKING_SELECT = '*, booking_calendar:booking_calendars(name, color, purpose, location_ids, reminders), lead:leads(id, first_name, last_name, phone, email), location:booking_locations(id, name, address, location_type)'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, userId, role } = await getWorkspaceId()
    const supabase = await createClient()

    const filters = bookingFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams))

    let query = supabase
      .from('bookings')
      .select(BOOKING_SELECT, { count: 'exact' })
      .eq('workspace_id', workspaceId)

    // Filtrage par rôle : setter/closer ne voient que leurs bookings
    if (role !== 'admin') {
      query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`)
    }

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

    // ── Branche récurrente : insère N occurrences avec un `recurrence_group_id`
    //    partagé. Pour éviter l'envoi de N emails/notifs, on skip les side-effects
    //    (calls, reminders, Google sync, email confirmation). Les triggers
    //    workflow ne se déclenchent pas non plus pour les séries.
    if (parsed.data.recurrence) {
      const { frequency, count } = parsed.data.recurrence
      const baseDate = new Date(parsed.data.scheduled_at)
      const groupId = crypto.randomUUID()
      const rows = Array.from({ length: count }, (_, i) => {
        const d = new Date(baseDate)
        if (frequency === 'daily') d.setDate(d.getDate() + i)
        else if (frequency === 'weekly') d.setDate(d.getDate() + i * 7)
        else if (frequency === 'monthly') d.setMonth(d.getMonth() + i)
        return {
          workspace_id: workspaceId,
          calendar_id: parsed.data.calendar_id ?? null,
          lead_id: parsed.data.lead_id ?? null,
          title: parsed.data.title,
          scheduled_at: d.toISOString(),
          duration_minutes: parsed.data.duration_minutes,
          notes: parsed.data.notes ?? null,
          is_personal: parsed.data.is_personal,
          location_id: parsed.data.location_id ?? null,
          source: 'manual' as const,
          recurrence_group_id: groupId,
        }
      })

      const { data: inserted, error: insertErr } = await supabase
        .from('bookings')
        .insert(rows)
        .select(BOOKING_SELECT)

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

      return NextResponse.json({ data: inserted ?? [], recurrence_group_id: groupId })
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

    // Auto-create call if calendar has purpose setting/closing
    if (data.lead_id && data.calendar_id) {
      const calPurpose = (data.booking_calendar as { purpose?: string } | null)?.purpose
      if (calPurpose === 'setting' || calPurpose === 'closing') {
        // Count existing calls for attempt_number
        const { count: callCount } = await supabase
          .from('calls')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('lead_id', data.lead_id)
          .eq('type', calPurpose)

        const calName = (data.booking_calendar as { name?: string } | null)?.name ?? ''
        const { data: newCall } = await supabase
          .from('calls')
          .insert({
            workspace_id: workspaceId,
            lead_id: data.lead_id,
            type: calPurpose,
            scheduled_at: data.scheduled_at,
            outcome: 'pending',
            attempt_number: (callCount ?? 0) + 1,
            reached: false,
            notes: `Via calendrier : ${calName}`,
          })
          .select('id')
          .single()

        if (newCall) {
          // Link call to booking
          await supabase
            .from('bookings')
            .update({ call_id: newCall.id })
            .eq('id', data.id)

          // Update lead status
          const newStatus = calPurpose === 'setting' ? 'setting_planifie' : 'closing_planifie'
          await supabase
            .from('leads')
            .update({ status: newStatus })
            .eq('id', data.lead_id)
            .eq('workspace_id', workspaceId)

          // Fire call_scheduled trigger
          fireTriggersForEvent(workspaceId, 'call_scheduled', {
            lead_id: data.lead_id,
            call_id: newCall.id,
            call_type: calPurpose,
          }).catch(() => {})
        }
      }
    }

    // Create booking reminders if calendar has reminders configured
    const calReminders = ((data.booking_calendar as { reminders?: unknown[] } | null)?.reminders ?? []) as CalendarReminder[]
    if (data.lead_id && data.calendar_id) {
      const calName = (data.booking_calendar as { name?: string } | null)?.name ?? ''
      const leadData = data.lead as { first_name?: string; last_name?: string } | null
      if (calReminders.length > 0 && leadData) {
        createBookingReminders({
          workspaceId,
          bookingId: data.id,
          leadId: data.lead_id,
          bookingScheduledAt: data.scheduled_at,
          calendarReminders: calReminders,
          calendarName: calName,
          lead: { first_name: leadData.first_name ?? '', last_name: leadData.last_name ?? '' },
        }).catch((err) => {
          console.error('[booking] Failed to create reminders:', err)
        })
      }
    }

    // The Confirmation reminder (delay 0, channel email) is sent directly
    // here at creation time (not queued in booking_reminders). We extract its
    // message + template config for sendBookingConfirmationEmail below.
    const emailConfirmationReminder = calReminders.find(
      (r) => r.channel === 'email' && r.delay_value === 0,
    )

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
    } else if (data.calendar_id) {
      // No explicit location — check calendar's locations for online/Meet
      const calLocationIds = (data.booking_calendar as { location_ids?: string[] } | null)?.location_ids
      if (calLocationIds && calLocationIds.length > 0) {
        const { data: locs } = await supabase
          .from('booking_locations')
          .select('location_type, name, address')
          .in('id', calLocationIds)
          .eq('workspace_id', workspaceId)
        const onlineLoc = locs?.find(l => l.location_type === 'online')
        if (onlineLoc) {
          isOnlineLocation = true
          locationName = onlineLoc.name
          locationAddress = onlineLoc.address
        }
      }
    }

    const scheduledAt = new Date(data.scheduled_at)
    const endAt = new Date(scheduledAt.getTime() + (data.duration_minutes ?? 30) * 60_000)

    // Use after() to ensure Google push + email run reliably post-response on Vercel
    after(async () => {
      try {
        const result = await createGoogleCalendarEvent(
          workspaceId,
          {
            summary: data.title,
            description: data.notes ?? undefined,
            start: { dateTime: scheduledAt.toISOString() },
            end: { dateTime: endAt.toISOString() },
          },
          { withMeet: isOnlineLocation && !locationAddress },
        )

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

        const leadEmail = (data.lead as { email?: string | null } | null)?.email
        if (leadEmail) {
          const leadFirst = (data.lead as { first_name?: string } | null)?.first_name ?? ''
          const leadLast = (data.lead as { last_name?: string } | null)?.last_name ?? ''
          const supa2 = await createClient()
          const [{ data: owner }, { data: cal }] = await Promise.all([
            supa2.from('users').select('full_name').eq('workspace_id', workspaceId).eq('role', 'coach').maybeSingle(),
            data.calendar_id
              ? supa2.from('booking_calendars').select('email_template, email_accent_color').eq('id', data.calendar_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          const calTemplate = (cal as { email_template?: 'premium' | 'minimal' | 'plain' } | null)?.email_template ?? 'premium'
          const calAccent = (cal as { email_accent_color?: string } | null)?.email_accent_color ?? '#E53E3E'

          // Resolve {{vars}} in the Confirmation reminder message if present
          const customMessage = emailConfirmationReminder
            ? emailConfirmationReminder.message
                .replace(/\{\{prenom\}\}/g, leadFirst)
                .replace(/\{\{nom\}\}/g, leadLast)
                .replace(/\{\{date_rdv\}\}/g, scheduledAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
                .replace(/\{\{heure_rdv\}\}/g, scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
                .replace(/\{\{nom_calendrier\}\}/g, (data.booking_calendar as { name?: string } | null)?.name ?? '')
            : undefined

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
          const manageToken = (data as unknown as { manage_token?: string }).manage_token
          const manageUrl = appUrl && manageToken
            ? `${appUrl}/booking/manage/${data.id}?token=${manageToken}`
            : undefined

          await sendBookingConfirmationEmail({
            to: leadEmail,
            workspaceId,
            coachName: owner?.full_name ?? 'Votre coach',
            prospectName: `${leadFirst} ${leadLast}`.trim(),
            date: scheduledAt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
            time: scheduledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            meetUrl: result?.meetUrl ?? undefined,
            locationName: locationName ?? undefined,
            locationAddress: locationAddress ?? undefined,
            template: calTemplate,
            accentColor: calAccent,
            customMessage,
            manageUrl,
          }).catch((err) => console.error('[booking] booking-confirmation email failed:', err instanceof Error ? err.message : err))
        }
      } catch (err) {
        console.error('[booking] Post-response work failed:', err instanceof Error ? err.message : err)
      }
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
