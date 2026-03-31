import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getGoogleCalendarEvents } from '@/lib/google/calendar'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch Google Calendar events for the next 30 days
    const timeMin = new Date().toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    console.log('[Google Sync] Fetching events for workspace:', workspaceId)
    const events = await getGoogleCalendarEvents(workspaceId, timeMin, timeMax)
    console.log('[Google Sync] Found', events.length, 'events from Google')

    if (events.length === 0) {
      return NextResponse.json({ synced: 0 })
    }

    // Get existing bookings with google_event_ids in this workspace
    const googleEventIds = events.map((e) => e.id)
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, google_event_id')
      .eq('workspace_id', workspaceId)
      .in('google_event_id', googleEventIds)

    const existingMap = new Map(
      (existingBookings ?? []).map((b) => [b.google_event_id, b.id])
    )

    let synced = 0

    for (const event of events) {
      // Skip all-day events (no dateTime)
      if (!event.start.dateTime || !event.end.dateTime) continue
      // Skip cancelled events
      if (event.status === 'cancelled') continue

      const startDate = new Date(event.start.dateTime)
      const endDate = new Date(event.end.dateTime)
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60_000)

      const bookingData = {
        title: event.summary || 'Google Calendar',
        scheduled_at: event.start.dateTime,
        duration_minutes: durationMinutes > 0 ? durationMinutes : 30,
        notes: event.description || null,
        source: 'google_sync' as const,
        is_personal: true,
        google_event_id: event.id,
      }

      if (existingMap.has(event.id)) {
        // Update existing booking
        const bookingId = existingMap.get(event.id)!
        await supabase
          .from('bookings')
          .update({
            title: bookingData.title,
            scheduled_at: bookingData.scheduled_at,
            duration_minutes: bookingData.duration_minutes,
            notes: bookingData.notes,
          })
          .eq('id', bookingId)
          .eq('workspace_id', workspaceId)
      } else {
        // Create new booking
        await supabase
          .from('bookings')
          .insert({
            workspace_id: workspaceId,
            ...bookingData,
            calendar_id: null,
            lead_id: null,
            status: 'confirmed',
            form_data: {},
            location_id: null,
          })
      }

      synced++
    }

    return NextResponse.json({ synced })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[Google Sync] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
