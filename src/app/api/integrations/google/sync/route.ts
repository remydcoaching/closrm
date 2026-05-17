import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getGoogleCalendarEvents } from '@/lib/google/calendar'
import { getGoogleAccounts } from '@/lib/google/accounts'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const accounts = await getGoogleAccounts(workspaceId)

    const timeMin = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let totalSynced = 0

    for (const account of accounts) {
      console.log('[Google Sync] Syncing account:', account.email)
      const events = await getGoogleCalendarEvents({ accountId: account.id }, timeMin, timeMax)
      console.log('[Google Sync]', account.email, '→', events.length, 'events')

      if (events.length === 0) continue

      const googleEventIds = events.map((e) => e.id)
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, google_event_id')
        .eq('workspace_id', workspaceId)
        .in('google_event_id', googleEventIds)

      const existingMap = new Map(
        (existingBookings ?? []).map((b) => [b.google_event_id, b.id])
      )

      for (const event of events) {
        if (!event.start.dateTime || !event.end.dateTime) continue
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
          google_account_id: account.id,
        }

        if (existingMap.has(event.id)) {
          const bookingId = existingMap.get(event.id)!
          await supabase
            .from('bookings')
            .update({
              title: bookingData.title,
              scheduled_at: bookingData.scheduled_at,
              duration_minutes: bookingData.duration_minutes,
              notes: bookingData.notes,
              google_account_id: account.id,
            })
            .eq('id', bookingId)
            .eq('workspace_id', workspaceId)
        } else {
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

        totalSynced++
      }
    }

    // Fallback: si aucun compte dans la nouvelle table, essayer l'ancien système
    if (accounts.length === 0) {
      console.log('[Google Sync] No accounts in new table, trying legacy integration')
      const events = await getGoogleCalendarEvents(workspaceId, timeMin, timeMax)

      if (events.length > 0) {
        const googleEventIds = events.map((e) => e.id)
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('id, google_event_id')
          .eq('workspace_id', workspaceId)
          .in('google_event_id', googleEventIds)

        const existingMap = new Map(
          (existingBookings ?? []).map((b) => [b.google_event_id, b.id])
        )

        for (const event of events) {
          if (!event.start.dateTime || !event.end.dateTime) continue
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

          totalSynced++
        }
      }
    }

    return NextResponse.json({ synced: totalSynced })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[Google Sync] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
