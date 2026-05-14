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
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
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
  /** Retire localement les events qui matchent le prédicat (optimistic). */
  removeEvents: (predicate: (ev: AgendaEvent) => boolean) => void
  /** Patch optimiste d'un event par id. */
  patchEvent: (id: string, updater: (ev: AgendaEvent) => AgendaEvent) => void
  /** Ajoute un event localement (optimistic insert). */
  addEvent: (ev: AgendaEvent) => void
}

function getDateRange(viewMode: AgendaViewMode, date: Date) {
  if (viewMode === 'day') {
    // BUG FIX : avant on retournait { start: date, end: date } (même instant),
    // donc l'API ne renvoyait que des events à la nanoseconde près. Il faut la
    // journée entière 00:00 → 23:59:59.999.
    return { start: startOfDay(date), end: endOfDay(date) }
  }
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
    // Data fetching on mount — setState inside the awaited fn est légitime.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCalendars()
  }, [fetchCalendars])

  /* Sync GCal au mount, throttlé à 1× toutes les 5 min via localStorage.
   * Évite le tap sur Google API à chaque clic sur /agenda (perf).
   * Si la dernière sync date < 5 min, on skip et on considère syncDone direct. */
  useEffect(() => {
    let cancelled = false
    const SYNC_TTL_MS = 5 * 60 * 1000
    const lastSyncRaw = typeof window !== 'undefined' ? localStorage.getItem('agenda:gcal-last-sync') : null
    const lastSync = lastSyncRaw ? Number(lastSyncRaw) : 0
    const fresh = Date.now() - lastSync < SYNC_TTL_MS

    if (fresh) {
      setSyncDone(true)
      return
    }

    fetch('/api/integrations/google/sync', { method: 'POST' })
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          try {
            localStorage.setItem('agenda:gcal-last-sync', String(Date.now()))
          } catch {
            // localStorage might be unavailable; non-fatal
          }
        } else {
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
    // per_page adaptatif : day-view ~10-15 events réel, week ~50, month ~150.
    // Avant : 100 hardcodé → soit on tronquait silencieusement en month chargé,
    // soit on rapatriait du vide en day. Ce fix réduit le payload et évite
    // la troncature.
    const perPage = viewMode === 'day' ? 30 : viewMode === 'week' ? 100 : 200
    const params = new URLSearchParams({
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      per_page: String(perPage),
    })

    const requests: Promise<Response>[] = [
      fetch(`/api/bookings?${params.toString()}`),
    ]
    if (includeCalls) {
      requests.push(
        fetch(
          `/api/calls?scheduled_after=${start.toISOString()}&scheduled_before=${end.toISOString()}&per_page=${perPage}`,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents()
  }, [fetchEvents])

  /* Refetch unique post-sync (transition false→true). Cf. fix Phase 0. */
  const didRefetchAfterSync = useRef(false)
  useEffect(() => {
    if (syncDone && !didRefetchAfterSync.current) {
      didRefetchAfterSync.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEvents()
    }
  }, [syncDone, fetchEvents])

  const dismissSyncError = useCallback(() => setSyncError(null), [])

  /** Retire localement un ou plusieurs events (optimistic update avant
   *  un DELETE serveur). Le refetch ultérieur réconcilie en cas d'erreur. */
  const removeEvents = useCallback((predicate: (ev: AgendaEvent) => boolean) => {
    setEvents((prev) => prev.filter((ev) => !predicate(ev)))
  }, [])

  /** Patch optimiste d'un event par id. Le `updater` reçoit l'event courant
   *  et doit renvoyer la version modifiée. */
  const patchEvent = useCallback((id: string, updater: (ev: AgendaEvent) => AgendaEvent) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? updater(ev) : ev)))
  }, [])

  /** Ajoute un event au state local (optimistic insert avant POST). Le refetch
   *  ultérieur le remplacera par la version serveur (avec l'ID réel). */
  const addEvent = useCallback((ev: AgendaEvent) => {
    setEvents((prev) => [...prev, ev])
  }, [])

  return {
    events,
    calendars,
    locations,
    loading,
    calendarsLoaded,
    syncError,
    dismissSyncError,
    refetch: fetchEvents,
    removeEvents,
    patchEvent,
    addEvent,
  }
}
