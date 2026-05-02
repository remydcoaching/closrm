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

import { useCallback, useMemo, useState } from 'react'
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

  // Filtres sidebar. Pattern : `'all'` = tout visible (état initial / "reset"),
  // sinon une Set explicite. Évite un useEffect d'initialisation.
  const [calendarVisibility, setCalendarVisibility] = useState<Set<string> | 'all'>('all')
  const [showPersonal, setShowPersonal] = useState(true)
  const [showCalls, setShowCalls] = useState(true)

  const {
    events,
    calendars,
    locations,
    calendarsLoaded,
    syncError,
    dismissSyncError,
    refetch,
  } = useAgendaData({ viewMode, currentDate })

  // Set des calendriers visibles, dérivé : si on est en mode `'all'`, c'est
  // l'ensemble de tous les calendriers connus à l'instant t (donc s'auto-met-
  // à-jour si un nouveau cal arrive sans qu'on touche au state).
  const visibleCalendarIds = useMemo<Set<string>>(() => {
    if (calendarVisibility === 'all') return new Set(calendars.map((c) => c.id))
    return calendarVisibility
  }, [calendarVisibility, calendars])

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (ev.kind === 'call') return showCalls
      const b = ev.booking
      if (b.is_personal) return showPersonal
      if (calendarVisibility === 'all') return true
      if (b.calendar_id) return visibleCalendarIds.has(b.calendar_id)
      return true
    })
  }, [events, visibleCalendarIds, calendarVisibility, showPersonal, showCalls])

  function toggleCalendar(id: string) {
    setCalendarVisibility((prev) => {
      // Première interaction : on matérialise la Set complète puis on toggle
      const base =
        prev === 'all'
          ? new Set(calendars.map((c) => c.id))
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

  const handleEventClick = useCallback((ev: AgendaEvent) => {
    setSelectedEvent(ev)
  }, [])

  const handleSlotClick = useCallback((dayDate: Date, hour: number) => {
    setSelectedEvent(null)
    setNewBookingPrefill({
      date: format(dayDate, 'yyyy-MM-dd'),
      time: hourToHHmm(hour),
      duration: DEFAULT_NEW_DURATION,
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

  async function handleDelete(ev: AgendaEvent) {
    if (ev.kind !== 'booking') return
    const res = await fetch(`/api/bookings/${ev.booking.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedEvent(null)
      refetch()
    } else {
      alert('Suppression échouée')
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
          />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {viewMode === 'week' && (
              <WeekView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                onSlotClick={handleSlotClick}
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
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {/* Modal création */}
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
