/**
 * Hook unique de chargement de données pour l'agenda (Phase 2 refonte).
 *
 * Il :
 *  - calcule le `[start, end]` de la fenêtre demandée selon `viewMode`
 *  - lance en parallèle 3 fetches (bookings, calls, calendars/locations chargés
 *    une seule fois)
 *  - dédoublonne : un call qui a déjà un booking lié (`booking.call_id`) est
 *    ignoré côté call pour ne pas apparaître deux fois dans la grille
 *  - mappe vers `AgendaEvent` via les helpers `bookingToAgendaEvent` /
 *    `callToAgendaEvent`
 *  - déclenche un sync GCal au mount (une seule fois) et expose son erreur
 *    éventuelle pour affichage dans une bannière
 *  - garantit qu'on ne refetch qu'une fois après le sync done (cf. fix Phase 0)
 *
 * Tout le reste (filtrage par calendar visible, status, etc.) se fait dans la
 * page agenda en mémoizant sur le tableau d'events retourné — pas la
 * responsabilité du hook.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type {
  BookingCalendar,
  BookingLocation,
  BookingWithCalendar,
  Call,
  Lead,
} from '@/types'
import {
  bookingToAgendaEvent,
  callToAgendaEvent,
  type AgendaEvent,
} from '@/types/agenda'

export type AgendaViewMode = 'day' | 'week' | 'month'

interface UseAgendaDataOptions {
  viewMode: AgendaViewMode
  currentDate: Date
  /** Si false, n'inclut pas les calls dans la fusion (utile si on monte un
   *  écran "bookings only" plus tard). Défaut true. */
  includeCalls?: boolean
}

interface UseAgendaDataResult {
  events: AgendaEvent[]
  /** Liste séparée pour la sidebar (toggle visibility) */
  calendars: BookingCalendar[]
  locations: BookingLocation[]
  loading: boolean
  /** True une fois `fetchCalendars` terminé — utile pour distinguer
   *  "loading initial" d'un "vraiment 0 calendrier". */
  calendarsLoaded: boolean
  /** Texte d'erreur si la sync GCal a échoué — à afficher dans une bannière. */
  syncError: string | null
  dismissSyncError: () => void
  refetch: () => Promise<void>
}

function getDateRange(viewMode: AgendaViewMode, date: Date) {
  if (viewMode === 'day') return { start: date, end: date }
  if (viewMode === 'week') {
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    }
  }
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

type CallWithLead = Call & {
  lead?: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
}

export function useAgendaData(opts: UseAgendaDataOptions): UseAgendaDataResult {
  const { viewMode, currentDate, includeCalls = true } = opts

  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarsLoaded, setCalendarsLoaded] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncDone, setSyncDone] = useState(false)

  const fetchCalendars = useCallback(async () => {
    const [calRes, locRes] = await Promise.all([
      fetch('/api/booking-calendars'),
      fetch('/api/booking-locations'),
    ])
    if (calRes.ok) {
      const json = await calRes.json()
      setCalendars(json.data ?? [])
    }
    if (locRes.ok) {
      const json = await locRes.json()
      setLocations(json.data ?? [])
    }
    setCalendarsLoaded(true)
  }, [])

  useEffect(() => {
    fetchCalendars()
  }, [fetchCalendars])

  /* Sync GCal au mount, une seule fois — si fail, on stocke l'erreur. */
  useEffect(() => {
    let cancelled = false
    fetch('/api/integrations/google/sync', { method: 'POST' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          setSyncError(
            body.length > 0 && body.length < 200
              ? body
              : 'Synchronisation Google Calendar échouée',
          )
        }
      })
      .catch(() => {
        if (!cancelled) setSyncError('Synchronisation Google Calendar indisponible')
      })
      .finally(() => {
        if (!cancelled) setSyncDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(viewMode, currentDate)
    const params = new URLSearchParams({
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      per_page: '100',
    })

    const requests: Promise<Response>[] = [
      fetch(`/api/bookings?${params.toString()}`),
    ]
    if (includeCalls) {
      requests.push(
        fetch(
          `/api/calls?scheduled_after=${start.toISOString()}&scheduled_before=${end.toISOString()}&per_page=100`,
        ),
      )
    }

    const responses = await Promise.all(requests)
    const bookingsRes = responses[0]
    const callsRes = includeCalls ? responses[1] : null

    const bookings: BookingWithCalendar[] = bookingsRes.ok
      ? (await bookingsRes.json()).data ?? []
      : []

    const calls: CallWithLead[] = callsRes && callsRes.ok
      ? (await callsRes.json()).data ?? []
      : []

    const linkedCallIds = new Set(
      bookings.map((b) => b.call_id).filter((x): x is string => Boolean(x)),
    )
    const callsToShow = calls.filter((c) => !linkedCallIds.has(c.id))

    const merged: AgendaEvent[] = [
      ...bookings.map(bookingToAgendaEvent),
      ...callsToShow.map(callToAgendaEvent),
    ]

    setEvents(merged)
    setLoading(false)
  }, [viewMode, currentDate, includeCalls])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  /* Refetch unique post-sync (transition false→true). Cf. fix Phase 0. */
  const didRefetchAfterSync = useRef(false)
  useEffect(() => {
    if (syncDone && !didRefetchAfterSync.current) {
      didRefetchAfterSync.current = true
      fetchEvents()
    }
  }, [syncDone, fetchEvents])

  const dismissSyncError = useCallback(() => setSyncError(null), [])

  return {
    events,
    calendars,
    locations,
    loading,
    calendarsLoaded,
    syncError,
    dismissSyncError,
    refetch: fetchEvents,
  }
}
