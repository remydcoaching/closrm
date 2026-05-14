'use client'

/**
 * Route /agenda/v2 — Phases 3a (statique) + 3b (interactions).
 *
 * Phase 3b ajoute :
 *  - Click event → side panel droit (push, pas overlay)
 *  - Click slot vide → ouvre NewBookingModal avec prefill date/heure/durée
 *  - Hover event → tooltip (géré dans EventTooltip dans WeekView)
 *  - Suppression d'event depuis le panel
 *
 * Cette route coexiste avec /agenda (l'ancienne) le temps de la refonte.
 * Au cutover (Phase 8), on renommera v2/ → agenda/ et l'ancienne ira en _old/.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { AlertTriangle, Plus } from 'lucide-react'
import { useAgendaData } from '@/lib/agenda/use-agenda-data'
import type { AgendaEvent } from '@/types/agenda'
import type { PlanningTemplate } from '@/types'
import { WeekView } from '@/components/agenda/v2/WeekView'
import { DayView } from '@/components/agenda/v2/DayView'
import { MonthView } from '@/components/agenda/v2/MonthView'
import { AgendaToolbar, type AgendaViewMode } from '@/components/agenda/v2/AgendaToolbar'
import { EventDetailPanel } from '@/components/agenda/v2/EventDetailPanel'
import { AgendaSidebar } from '@/components/agenda/v2/AgendaSidebar'
import NewBookingModal from '@/components/agenda/NewBookingModal'

const DEFAULT_NEW_DURATION = 60

function formatPeriodLabel(viewMode: AgendaViewMode, date: Date): string {
  if (viewMode === 'day') return format(date, 'EEEE d MMMM yyyy', { locale: fr })
  if (viewMode === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    const end = endOfWeek(date, { weekStartsOn: 1 })
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'd', { locale: fr })} – ${format(end, 'd MMMM yyyy', { locale: fr })}`
    }
    return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
  }
  return format(date, 'MMMM yyyy', { locale: fr })
}

function hourToHHmm(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function AgendaV2Page() {
  const [viewMode, setViewMode] = useState<AgendaViewMode>('week')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null)
  const [newBookingPrefill, setNewBookingPrefill] = useState<{
    date: string
    time: string
    duration: number
  } | null>(null)
  const [templates, setTemplates] = useState<PlanningTemplate[]>([])
  const [pendingReschedule, setPendingReschedule] = useState<{
    event: AgendaEvent
    newScheduledAt: string
    newDurationMinutes?: number
  } | null>(null)
  // Sidebar masquée par défaut — pour un coach solo avec 1-2 calendriers,
  // les filtres + mini-cal sont du bruit visuel. Toggle dans la toolbar pour
  // l'afficher (utile en multi-calendriers).
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Filtres sidebar. Pattern : `'all'` = tout visible (état initial / "reset"),
  // sinon une Set explicite. Évite un useEffect d'initialisation.
  const [calendarVisibility, setCalendarVisibility] = useState<Set<string> | 'all'>('all')
  const [googleAccountVisibility, setGoogleAccountVisibility] = useState<Set<string> | 'all'>('all')
  const [showPersonal, setShowPersonal] = useState(true)
  const [showCalls, setShowCalls] = useState(true)

  const {
    events,
    calendars,
    locations,
    googleAccounts,
    calendarsLoaded,
    syncError,
    dismissSyncError,
    refetch,
    removeEvents,
    patchEvent,
    addEvent,
  } = useAgendaData({ viewMode, currentDate })

  // Charge les templates planning au montage (single hit, hors render critique)
  useEffect(() => {
    let cancelled = false
    fetch('/api/planning-templates')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (cancelled) return
        setTemplates((json?.data ?? []) as PlanningTemplate[])
      })
      .catch(() => { /* silently ignore */ })
    return () => { cancelled = true }
  }, [])

  const handleImportTemplate = useCallback(async (templateId: string) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const res = await fetch(`/api/planning-templates/${templateId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start: format(weekStart, 'yyyy-MM-dd'),
        timezone_offset: new Date().getTimezoneOffset(),
      }),
    })
    if (res.ok) refetch()
  }, [currentDate, refetch])

  // Set des calendriers visibles, dérivé : si on est en mode `'all'`, c'est
  // l'ensemble de tous les calendriers connus à l'instant t (donc s'auto-met-
  // à-jour si un nouveau cal arrive sans qu'on touche au state).
  const visibleCalendarIds = useMemo<Set<string>>(() => {
    if (calendarVisibility === 'all') return new Set(calendars.map((c) => c.id))
    return calendarVisibility
  }, [calendarVisibility, calendars])

  const visibleGoogleAccountIds = useMemo<Set<string>>(() => {
    if (googleAccountVisibility === 'all') return new Set(googleAccounts.map((a) => a.id))
    return googleAccountVisibility
  }, [googleAccountVisibility, googleAccounts])

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (ev.kind === 'call') return showCalls
      const b = ev.booking
      // Google-synced bookings: filter by google_account_id
      if (b.source === 'google_sync' && b.google_account_id) {
        if (googleAccountVisibility !== 'all' && !visibleGoogleAccountIds.has(b.google_account_id)) return false
        if (b.is_personal) return showPersonal
        return true
      }
      if (b.is_personal) return showPersonal
      if (calendarVisibility === 'all') return true
      if (b.calendar_id) return visibleCalendarIds.has(b.calendar_id)
      return true
    })
  }, [events, visibleCalendarIds, calendarVisibility, visibleGoogleAccountIds, googleAccountVisibility, showPersonal, showCalls])

  function toggleCalendar(id: string) {
    setCalendarVisibility((prev) => {
      const base =
        prev === 'all'
          ? new Set(calendars.map((c) => c.id))
          : new Set(prev)
      if (base.has(id)) base.delete(id)
      else base.add(id)
      return base
    })
  }

  function toggleGoogleAccount(id: string) {
    setGoogleAccountVisibility((prev) => {
      const base =
        prev === 'all'
          ? new Set(googleAccounts.map((a) => a.id))
          : new Set(prev)
      if (base.has(id)) base.delete(id)
      else base.add(id)
      return base
    })
  }

  const periodLabel = useMemo(
    () => formatPeriodLabel(viewMode, currentDate),
    [viewMode, currentDate],
  )

  function navigatePrev() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, -1))
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1))
    else setCurrentDate((d) => subMonths(d, 1))
  }
  function navigateNext() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1))
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1))
    else setCurrentDate((d) => addMonths(d, 1))
  }
  function navigateToday() {
    setCurrentDate(new Date())
  }

  // ── Sélection + copy/paste ──
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const [copiedEvent, setCopiedEvent] = useState<AgendaEvent | null>(null)
  const hoverPosRef = useRef<{ date: Date; hour: number } | null>(null)

  const handleEventClick = useCallback((ev: AgendaEvent) => {
    setHighlightedEventId(ev.id)
    setSelectedEvent(ev)
  }, [])

  const handleHoverChange = useCallback((date: Date | null, hour: number | null) => {
    hoverPosRef.current = date && hour !== null ? { date, hour } : null
  }, [])

  const handleSlotClick = useCallback((dayDate: Date, hour: number, durationMinutes?: number) => {
    setSelectedEvent(null)
    setHighlightedEventId(null)
    setNewBookingPrefill({
      date: format(dayDate, 'yyyy-MM-dd'),
      time: hourToHHmm(hour),
      duration: durationMinutes ?? DEFAULT_NEW_DURATION,
    })
  }, [])

  function handleNewBookingClick() {
    setSelectedEvent(null)
    setNewBookingPrefill({
      date: format(currentDate, 'yyyy-MM-dd'),
      time: '09:00',
      duration: DEFAULT_NEW_DURATION,
    })
  }

  function handleEventMove(ev: AgendaEvent, newScheduledAt: string) {
    if (ev.kind !== 'booking') return
    if (ev.booking.is_personal) {
      applyReschedule(ev, newScheduledAt, undefined, false)
      return
    }
    setPendingReschedule({ event: ev, newScheduledAt })
  }

  function handleEventResize(ev: AgendaEvent, newScheduledAt: string, newDurationMinutes: number) {
    if (ev.kind !== 'booking') return
    if (ev.booking.is_personal) {
      applyReschedule(ev, newScheduledAt, newDurationMinutes, false)
      return
    }
    setPendingReschedule({ event: ev, newScheduledAt, newDurationMinutes })
  }

  async function applyReschedule(ev: AgendaEvent, newScheduledAt: string, newDurationMinutes: number | undefined, notifyLead: boolean) {
    if (ev.kind !== 'booking') return
    patchEvent(ev.id, (e) => {
      if (e.kind !== 'booking') return e
      return {
        ...e,
        start: newScheduledAt,
        durationMinutes: newDurationMinutes ?? e.durationMinutes,
        booking: {
          ...e.booking,
          scheduled_at: newScheduledAt,
          ...(newDurationMinutes ? { duration_minutes: newDurationMinutes } : {}),
        },
      }
    })
    try {
      const body: Record<string, unknown> = { scheduled_at: newScheduledAt }
      if (newDurationMinutes) body.duration_minutes = newDurationMinutes
      if (notifyLead) body.notify_lead = true
      const res = await fetch(`/api/bookings/${ev.booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        alert('Modification échouée')
        refetch()
      }
    } catch {
      alert('Modification échouée (réseau)')
      refetch()
    }
  }

  async function handleStatusChange(ev: AgendaEvent, status: string) {
    if (ev.kind !== 'booking') return
    // Optimistic d'abord : patch local instantané pour éviter un refetch des
    // 100 bookings (qui causait un freeze visible à chaque clic statut).
    patchEvent(ev.id, (e) => {
      if (e.kind !== 'booking') return e
      return {
        ...e,
        booking: { ...e.booking, status: status as typeof e.booking.status },
      }
    })
    setSelectedEvent({
      ...ev,
      booking: { ...ev.booking, status: status as typeof ev.booking.status },
    })

    const isPendingConfirm = ev.booking.status === 'pending' && status === 'confirmed'
    try {
      const res = isPendingConfirm
        ? await fetch(`/api/bookings/${ev.booking.id}/confirm`, { method: 'POST' })
        : await fetch(`/api/bookings/${ev.booking.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
      if (!res.ok) {
        alert('Changement de statut échoué')
        refetch()
      }
    } catch {
      alert('Changement de statut échoué (réseau)')
      refetch()
    }
  }

  /** Sauvegarde inline depuis le panel : PATCH partiel + optimistic update.
   *  Pas d'ouverture de modal. */
  async function handleSaveEdit(
    ev: AgendaEvent,
    patch: { title?: string; scheduled_at?: string; duration_minutes?: number; notes?: string | null; color?: string | null },
  ) {
    if (ev.kind !== 'booking') return

    // Resolve la nouvelle couleur d'affichage : si color est explicitement
    // passé (même null), c'est l'override ; sinon on garde l'ancienne.
    const fallbackColor = ev.booking.is_personal
      ? '#6b7280'
      : ev.booking.booking_calendar?.color ?? '#3b82f6'
    const newDisplayColor = patch.color !== undefined
      ? (patch.color ?? fallbackColor)
      : ev.color

    // Optimistic : applique le patch sur l'event courant
    patchEvent(ev.id, (e) => {
      if (e.kind !== 'booking') return e
      const newStart = patch.scheduled_at ?? e.start
      const newDuration = patch.duration_minutes ?? e.durationMinutes
      const newTitle = patch.title ?? e.title
      const newNotes = patch.notes !== undefined ? patch.notes : e.booking.notes
      const newColor = patch.color !== undefined ? patch.color : e.booking.color
      return {
        ...e,
        title: newTitle,
        start: newStart,
        durationMinutes: newDuration,
        color: newDisplayColor,
        booking: {
          ...e.booking,
          title: newTitle,
          scheduled_at: newStart,
          duration_minutes: newDuration,
          notes: newNotes,
          color: newColor,
        },
      }
    })
    // Met à jour le selectedEvent pour rester cohérent dans le panel
    setSelectedEvent((cur) => {
      if (!cur || cur.id !== ev.id || cur.kind !== 'booking') return cur
      const newStart = patch.scheduled_at ?? cur.start
      const newDuration = patch.duration_minutes ?? cur.durationMinutes
      const newTitle = patch.title ?? cur.title
      const newNotes = patch.notes !== undefined ? patch.notes : cur.booking.notes
      const newColor = patch.color !== undefined ? patch.color : cur.booking.color
      return {
        ...cur,
        title: newTitle,
        start: newStart,
        durationMinutes: newDuration,
        color: newDisplayColor,
        booking: {
          ...cur.booking,
          title: newTitle,
          scheduled_at: newStart,
          duration_minutes: newDuration,
          notes: newNotes,
          color: newColor,
        },
      }
    })

    try {
      const res = await fetch(`/api/bookings/${ev.booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        alert('Modification échouée')
        refetch()
      }
    } catch {
      alert('Modification échouée (réseau)')
      refetch()
    }
  }

  // ── Cmd+C / Cmd+V : copy / paste de l'event highlighted ──
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }
    function onKey(e: KeyboardEvent) {
      const isCopy = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c'
      const isPaste = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v'
      if (!isCopy && !isPaste) return
      if (isTypingTarget(e.target)) return

      if (isCopy && highlightedEventId) {
        const ev = events.find((x) => x.id === highlightedEventId)
        if (!ev) return
        e.preventDefault()
        setCopiedEvent(ev)
        return
      }
      if (isPaste && copiedEvent && hoverPosRef.current) {
        e.preventDefault()
        const { date, hour } = hoverPosRef.current
        const newDate = new Date(date)
        const h = Math.floor(hour)
        const m = Math.round((hour - h) * 60)
        const snappedM = m < 15 ? 0 : m < 45 ? 30 : 60
        if (snappedM === 60) { newDate.setHours(h + 1, 0, 0, 0) }
        else { newDate.setHours(h, snappedM, 0, 0) }

        const sourceBooking = copiedEvent.kind === 'booking' ? copiedEvent.booking : null

        // ── Optimistic : on insère immédiatement dans le state local avec un
        //    ID temporaire. Le refetch après POST remplace par la vraie row.
        const tempId = `tmp-${crypto.randomUUID()}`
        const newScheduledAt = newDate.toISOString()
        if (copiedEvent.kind === 'booking' && sourceBooking) {
          const optimistic: AgendaEvent = {
            ...copiedEvent,
            id: tempId,
            start: newScheduledAt,
            booking: {
              ...sourceBooking,
              id: tempId,
              scheduled_at: newScheduledAt,
              lead_id: null,
              call_id: null,
              google_event_id: null,
              meet_url: null,
              recurrence_group_id: null,
            },
            lead: null,
          }
          addEvent(optimistic)
        }

        const payload: Record<string, unknown> = {
          is_personal: sourceBooking?.is_personal ?? true,
          calendar_id: sourceBooking?.calendar_id ?? null,
          lead_id: null,
          location_id: sourceBooking?.location_id ?? null,
          title: copiedEvent.title,
          scheduled_at: newScheduledAt,
          duration_minutes: copiedEvent.durationMinutes,
          notes: sourceBooking?.notes ?? null,
        }

        fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((res) => { if (res.ok) refetch() })
          .catch(() => { /* silently ignore */ })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [events, highlightedEventId, copiedEvent, refetch])

  // Raccourci clavier : Backspace / Delete supprime l'event highlighted
  // (ou sélectionné dans le panel). Bookings uniquement, scope='this' par défaut.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (target.isContentEditable) return true
      return false
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      if (isTypingTarget(e.target)) return
      // Cible : event du panel en priorité, sinon l'event highlighted
      const target = selectedEvent
        ?? (highlightedEventId ? events.find((x) => x.id === highlightedEventId) ?? null : null)
      if (!target || target.kind !== 'booking') return
      e.preventDefault()
      handleDelete(target, 'this')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, highlightedEventId, events])

  async function handleDelete(ev: AgendaEvent, scope: 'this' | 'future' | 'all' = 'this') {
    if (ev.kind !== 'booking') return

    // Optimistic update : on retire d'abord l'event (ou le groupe) du state local,
    // puis on fire le DELETE en arrière-plan. Si l'API échoue, on refetch pour
    // récupérer l'état réel.
    const groupId = ev.booking.recurrence_group_id
    const targetTime = ev.booking.scheduled_at
    if (scope === 'this' || !groupId) {
      removeEvents((other) => other.kind === 'booking' && other.booking.id === ev.booking.id)
    } else if (scope === 'future' && groupId) {
      removeEvents((other) =>
        other.kind === 'booking'
        && other.booking.recurrence_group_id === groupId
        && other.booking.scheduled_at >= targetTime,
      )
    } else if (scope === 'all' && groupId) {
      removeEvents((other) =>
        other.kind === 'booking' && other.booking.recurrence_group_id === groupId,
      )
    }
    setSelectedEvent(null)

    const url = `/api/bookings/${ev.booking.id}${scope !== 'this' ? `?scope=${scope}` : ''}`
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        alert('Suppression échouée')
        refetch() // réconcilie l'état
      }
    } catch {
      alert('Suppression échouée (réseau)')
      refetch()
    }
  }

  const noCalendars = calendarsLoaded && calendars.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AgendaToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        periodLabel={periodLabel}
        onPrev={navigatePrev}
        onNext={navigateNext}
        onToday={navigateToday}
        templates={templates}
        onImportTemplate={handleImportTemplate}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      {syncError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
            color: 'var(--text-primary)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--color-primary)' }} />
          <span style={{ flex: 1 }}>{syncError}</span>
          <button
            type="button"
            onClick={dismissSyncError}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* Content row : main view + side panel */}
      {noCalendars ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Aucun calendrier configuré
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.5 }}>
            Crée ton premier calendrier de réservation pour commencer.
          </div>
          <Link
            href="/parametres/calendriers"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Configurer un calendrier
          </Link>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {sidebarOpen && (
            <AgendaSidebar
              selectedDate={currentDate}
              onSelectDate={setCurrentDate}
              calendars={calendars}
              visibleCalendarIds={visibleCalendarIds}
              onToggleCalendar={toggleCalendar}
              showPersonal={showPersonal}
              onTogglePersonal={() => setShowPersonal((v) => !v)}
              showCalls={showCalls}
              onToggleCalls={() => setShowCalls((v) => !v)}
              googleAccounts={googleAccounts}
              visibleGoogleAccountIds={visibleGoogleAccountIds}
              onToggleGoogleAccount={toggleGoogleAccount}
            />
          )}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {viewMode === 'week' && (
              <WeekView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onSlotClick={handleSlotClick}
                onEventMove={handleEventMove}
                onEventResize={handleEventResize}
                highlightedEventId={highlightedEventId}
                onHoverChange={handleHoverChange}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onSlotClick={handleSlotClick}
              />
            )}
            {viewMode === 'month' && (
              <MonthView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onDayClick={(d) => {
                  setCurrentDate(d)
                  setViewMode('day')
                }}
              />
            )}
            {/* FAB nouveau RDV — placé en bas-droite, mais au-dessus du panel */}
            <button
              type="button"
              onClick={handleNewBookingClick}
              aria-label="Nouveau rendez-vous"
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              <Plus size={15} /> Nouveau RDV
            </button>
          </div>
          {pendingReschedule && (
            <div
              onClick={() => { refetch(); setPendingReschedule(null) }}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, zIndex: 9999,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 16,
                  padding: '24px',
                  maxWidth: 420,
                  width: '100%',
                  boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Modifier l&apos;horaire du rendez-vous ?
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {pendingReschedule.event.title} — {(() => {
                    const d = new Date(pendingReschedule.newScheduledAt)
                    return `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                  })()}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const p = pendingReschedule
                      setPendingReschedule(null)
                      applyReschedule(p.event, p.newScheduledAt, p.newDurationMinutes, true)
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--color-primary)',
                      color: '#000',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Modifier et prévenir le prospect par email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = pendingReschedule
                      setPendingReschedule(null)
                      applyReschedule(p.event, p.newScheduledAt, p.newDurationMinutes, false)
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--border-secondary)',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Modifier sans prévenir
                  </button>
                  <button
                    type="button"
                    onClick={() => { refetch(); setPendingReschedule(null) }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onSave={handleSaveEdit}
            />
          )}
        </div>
      )}

      {/* Modal création (l'édition se fait inline dans le panel détail) */}
      {newBookingPrefill && (
        <NewBookingModal
          calendars={calendars}
          locations={locations}
          prefillDate={newBookingPrefill.date}
          prefillTime={newBookingPrefill.time}
          prefillDuration={newBookingPrefill.duration}
          onClose={() => setNewBookingPrefill(null)}
          onCreated={() => {
            setNewBookingPrefill(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
