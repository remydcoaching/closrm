// Port of the web's src/lib/agenda/use-agenda-data.ts — same endpoints, same
// window per view, same Google Calendar sync on mount (throttled to 1× every
// 5 min via localStorage), same bookings/calls dedup.
import { getCached, revalidate } from '../../lib/query-cache'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { getDateRange, mergeEvents, perPageFor } from './agenda-utils'
import type {
  AgendaCall,
  AgendaEvent,
  AgendaViewMode,
  BookingCalendar,
  BookingLocation,
  BookingWithCalendar,
  GoogleCalendarAccount,
  ListResponse,
} from './types'

const SYNC_KEY = 'agenda:gcal-last-sync'
const SYNC_TTL_MS = 5 * 60 * 1000

export function useAgendaData(view: AgendaViewMode, currentDate: Date) {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [googleAccounts, setGoogleAccounts] = useState<GoogleCalendarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarsLoaded, setCalendarsLoaded] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncDone, setSyncDone] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    let cancelled = false
    // Cached settings first (instant), then fresh.
    const cachedCal = getCached<ListResponse<BookingCalendar>>('/api/booking-calendars')
    if (cachedCal) {
      setCalendars(cachedCal.data.data ?? [])
      setLocations(getCached<ListResponse<BookingLocation>>('/api/booking-locations')?.data.data ?? [])
      setGoogleAccounts(getCached<ListResponse<GoogleCalendarAccount>>('/api/google-calendar-accounts')?.data.data ?? [])
      setCalendarsLoaded(true)
    }
    Promise.allSettled([
      revalidate<ListResponse<BookingCalendar>>('/api/booking-calendars'),
      revalidate<ListResponse<BookingLocation>>('/api/booking-locations'),
      revalidate<ListResponse<GoogleCalendarAccount>>('/api/google-calendar-accounts'),
    ]).then(([cal, loc, gca]) => {
      if (cancelled) return
      if (cal.status === 'fulfilled') setCalendars(cal.value.data ?? [])
      if (loc.status === 'fulfilled') setLocations(loc.value.data ?? [])
      if (gca.status === 'fulfilled') setGoogleAccounts(gca.value.data ?? [])
      setCalendarsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let last = 0
    try {
      last = Number(localStorage.getItem(SYNC_KEY) ?? 0)
    } catch {
      last = 0
    }
    if (Date.now() - last < SYNC_TTL_MS) {
      setSyncDone(true)
      return
    }
    api
      .post('/api/integrations/google/sync', {})
      .then(() => {
        try {
          localStorage.setItem(SYNC_KEY, String(Date.now()))
        } catch {
          // non-fatal
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof ApiError && err.message.length < 200 ? err.message : ''
        setSyncError(msg ? `Synchronisation Google Calendar échouée — ${msg}` : 'Synchronisation Google Calendar indisponible')
      })
      .finally(() => {
        if (!cancelled) setSyncDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    const { start, end } = getDateRange(view, currentDate)
    const perPage = perPageFor(view)
    const params = new URLSearchParams({ date_start: start.toISOString(), date_end: end.toISOString(), per_page: String(perPage) })
    const callParams = new URLSearchParams({
      scheduled_after: start.toISOString(),
      scheduled_before: end.toISOString(),
      per_page: String(perPage),
    })
    const bookingsKey = `/api/bookings?${params.toString()}`
    const callsKey = `/api/calls?${callParams.toString()}`
    // Week/month already seen: show it at once, refresh behind.
    const cachedBookings = getCached<ListResponse<BookingWithCalendar>>(bookingsKey)
    if (cachedBookings) {
      setEvents(mergeEvents(cachedBookings.data.data ?? [], getCached<ListResponse<AgendaCall>>(callsKey)?.data.data ?? []))
      setLoading(false)
    }
    try {
      const [bookingsRes, callsRes] = await Promise.allSettled([
        revalidate<ListResponse<BookingWithCalendar>>(bookingsKey),
        revalidate<ListResponse<AgendaCall>>(callsKey),
      ])
      if (id !== requestId.current) return
      if (bookingsRes.status === 'rejected') throw bookingsRes.reason
      const calls = callsRes.status === 'fulfilled' ? callsRes.value.data ?? [] : []
      setEvents(mergeEvents(bookingsRes.value.data ?? [], calls))
    } catch (err) {
      if (id !== requestId.current) return
      setError(err instanceof Error ? err.message : 'Impossible de charger l’agenda')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [view, currentDate])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  // One refetch once the Google sync finishes (web "Phase 0" fix).
  const didRefetchAfterSync = useRef(false)
  useEffect(() => {
    if (syncDone && !didRefetchAfterSync.current) {
      didRefetchAfterSync.current = true
      void fetchEvents()
    }
  }, [syncDone, fetchEvents])

  const removeEvents = useCallback((predicate: (ev: AgendaEvent) => boolean) => {
    setEvents((prev) => prev.filter((ev) => !predicate(ev)))
  }, [])

  const patchEvent = useCallback((id: string, updater: (ev: AgendaEvent) => AgendaEvent) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? updater(ev) : ev)))
  }, [])

  return {
    events,
    calendars,
    locations,
    googleAccounts,
    loading,
    error,
    calendarsLoaded,
    syncError,
    dismissSyncError: () => setSyncError(null),
    refetch: fetchEvents,
    removeEvents,
    patchEvent,
  }
}
