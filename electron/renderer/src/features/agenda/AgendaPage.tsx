// Agenda › Vue calendrier — port of src/app/(dashboard)/agenda/v2/page.tsx.
// Views Jour / Semaine / Mois / Liste, prev / today / next, visibility filters
// (calendriers, comptes Google, personnel, appels), planning-template import,
// click 1 = highlight / click 2 = detail drawer, slot click or drag = new RDV,
// drag-move / resize with "prévenir le prospect" confirmation, Cmd+C/Cmd+V
// duplicate, Delete/Backspace removes the highlighted booking.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Tabs } from '../../design-system/Tabs'
import { FilterMenu, type FilterOption } from '../../design-system/FilterMenu'
import { Button } from '../../design-system/Button'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import '../leads/lead-create-modal.css'
import './agenda.css'
import { useAgendaData } from './useAgendaData'
import { TimeGridView } from './TimeGridView'
import { ListView, MonthView } from './MonthAndListViews'
import { EventDetailDrawer } from './EventDetailDrawer'
import { BookingModal } from './BookingModal'
import {
  addDays,
  filterEvents,
  formatDateTime,
  formatPeriodLabel,
  hourToHHmm,
  navigate as navigateDate,
  startOfWeek,
  toDateInput,
} from './agenda-utils'
import type {
  AgendaBookingEvent,
  AgendaEvent,
  AgendaViewMode,
  BookingPatch,
  BookingStatus,
  DeleteScope,
  ListResponse,
  PlanningTemplate,
} from './types'

const VIEW_TABS: { key: AgendaViewMode; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'list', label: 'Liste' },
]

const DEFAULT_NEW_DURATION = 60

interface PendingReschedule {
  event: AgendaBookingEvent
  newScheduledAt: string
  newDurationMinutes?: number
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

export function AgendaPage() {
  const routerNavigate = useNavigate()
  const [view, setView] = useState<AgendaViewMode>('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const data = useAgendaData(view, currentDate)
  const { events, calendars, locations, googleAccounts, patchEvent, removeEvents, refetch } = data

  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<{ date: string; time: string; duration: number } | null>(null)
  const [pendingReschedule, setPendingReschedule] = useState<PendingReschedule | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<PlanningTemplate[]>([])
  const [importing, setImporting] = useState(false)

  // Visibility filters — hidden sets so new calendars show up by default.
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<Set<string>>(new Set())
  const [hiddenGoogleAccountIds, setHiddenGoogleAccountIds] = useState<Set<string>>(new Set())
  const [showPersonal, setShowPersonal] = useState(true)
  const [showCalls, setShowCalls] = useState(true)

  const copiedRef = useRef<AgendaEvent | null>(null)
  const hoverRef = useRef<{ day: Date; hour: number } | null>(null)

  useEffect(() => {
    api
      .get<ListResponse<PlanningTemplate>>('/api/planning-templates')
      .then((res) => setTemplates(res.data ?? []))
      .catch(() => setTemplates([]))
  }, [])

  const filtered = useMemo(
    () => filterEvents(events, { hiddenCalendarIds, hiddenGoogleAccountIds, showPersonal, showCalls }),
    [events, hiddenCalendarIds, hiddenGoogleAccountIds, showPersonal, showCalls],
  )
  const selectedEvent = selectedId ? events.find((e) => e.id === selectedId) ?? null : null

  const filterOptions: FilterOption[] = [
    ...calendars.map((c) => ({ key: `cal:${c.id}`, label: c.name, color: c.color })),
    ...googleAccounts.map((a) => ({ key: `gca:${a.id}`, label: `Google · ${a.label || a.email}`, color: a.color })),
    { key: 'personal', label: 'Personnel', color: '#6b7280' },
    { key: 'calls', label: 'Appels (setting / closing)', color: '#3b82f6' },
  ]
  const visibleKeys = filterOptions
    .map((o) => o.key)
    .filter((k) => {
      if (k.startsWith('cal:')) return !hiddenCalendarIds.has(k.slice(4))
      if (k.startsWith('gca:')) return !hiddenGoogleAccountIds.has(k.slice(4))
      if (k === 'personal') return showPersonal
      return showCalls
    })

  function applyVisibility(next: string[]) {
    const set = new Set(next)
    setHiddenCalendarIds(new Set(calendars.filter((c) => !set.has(`cal:${c.id}`)).map((c) => c.id)))
    setHiddenGoogleAccountIds(new Set(googleAccounts.filter((a) => !set.has(`gca:${a.id}`)).map((a) => a.id)))
    setShowPersonal(set.has('personal'))
    setShowCalls(set.has('calls'))
  }

  const days = useMemo(() => {
    if (view === 'day') return [new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())]
    const start = startOfWeek(currentDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [view, currentDate])

  const periodLabel = formatPeriodLabel(view, currentDate)

  const handleEventClick = useCallback((ev: AgendaEvent) => {
    // Click 1 = highlight; click 2 on the same event = detail drawer.
    setHighlightedId((prev) => {
      if (prev === ev.id) {
        setSelectedId(ev.id)
        return prev
      }
      setSelectedId(null)
      return ev.id
    })
  }, [])

  const handleSlotCreate = useCallback((day: Date, hour: number, durationMinutes?: number) => {
    setSelectedId(null)
    setHighlightedId(null)
    setPrefill({ date: toDateInput(day), time: hourToHHmm(hour), duration: durationMinutes ?? DEFAULT_NEW_DURATION })
  }, [])

  const handleHoverChange = useCallback((day: Date | null, hour: number | null) => {
    hoverRef.current = day && hour !== null ? { day, hour } : null
  }, [])

  function reportError(msg: string) {
    setActionError(msg)
    void refetch()
  }

  function optimisticBookingPatch(ev: AgendaEvent, patch: BookingPatch) {
    patchEvent(ev.id, (e) => {
      if (e.kind !== 'booking') return e
      const b = e.booking
      const nextColor = patch.color !== undefined ? patch.color : b.color
      const fallback = b.is_personal ? '#6b7280' : b.booking_calendar?.color ?? '#3b82f6'
      const booking = {
        ...b,
        title: patch.title ?? b.title,
        scheduled_at: patch.scheduled_at ?? b.scheduled_at,
        duration_minutes: patch.duration_minutes ?? b.duration_minutes,
        status: patch.status ?? b.status,
        notes: patch.notes !== undefined ? patch.notes : b.notes,
        color: nextColor,
        blocks_availability: patch.blocks_availability ?? b.blocks_availability,
      }
      return {
        ...e,
        title: patch.title ?? e.title,
        start: booking.scheduled_at,
        durationMinutes: booking.duration_minutes,
        color: patch.color !== undefined ? nextColor ?? fallback : e.color,
        booking,
      }
    })
  }

  async function saveBooking(ev: AgendaEvent, patch: BookingPatch) {
    if (ev.kind !== 'booking') return
    const { notify_lead: _notify, ...visible } = patch
    optimisticBookingPatch(ev, visible)
    try {
      await api.patch(`/api/bookings/${ev.booking.id}`, patch)
    } catch (err) {
      reportError(err instanceof Error ? `Modification échouée — ${err.message}` : 'Modification échouée')
    }
  }

  async function changeStatus(ev: AgendaEvent, status: BookingStatus) {
    if (ev.kind !== 'booking') return
    const isPendingConfirm = ev.booking.status === 'pending' && status === 'confirmed'
    optimisticBookingPatch(ev, { status })
    try {
      if (isPendingConfirm) await api.post(`/api/bookings/${ev.booking.id}/confirm`, {})
      else await api.patch(`/api/bookings/${ev.booking.id}`, { status })
    } catch (err) {
      reportError(err instanceof Error ? `Changement de statut échoué — ${err.message}` : 'Changement de statut échoué')
    }
  }

  async function deleteBooking(ev: AgendaEvent, scope: DeleteScope) {
    if (ev.kind !== 'booking') return
    const groupId = ev.booking.recurrence_group_id
    const at = ev.booking.scheduled_at
    if (scope === 'this' || !groupId) removeEvents((o) => o.kind === 'booking' && o.booking.id === ev.booking.id)
    else if (scope === 'future')
      removeEvents((o) => o.kind === 'booking' && o.booking.recurrence_group_id === groupId && o.booking.scheduled_at >= at)
    else removeEvents((o) => o.kind === 'booking' && o.booking.recurrence_group_id === groupId)
    setSelectedId(null)
    setHighlightedId(null)
    try {
      await api.delete(`/api/bookings/${ev.booking.id}${scope !== 'this' ? `?scope=${scope}` : ''}`)
    } catch (err) {
      reportError(err instanceof Error ? `Suppression échouée — ${err.message}` : 'Suppression échouée')
    }
  }

  function applyReschedule(p: PendingReschedule, notifyLead: boolean) {
    const patch: BookingPatch = { scheduled_at: p.newScheduledAt }
    if (p.newDurationMinutes) patch.duration_minutes = p.newDurationMinutes
    if (notifyLead) patch.notify_lead = true
    void saveBooking(p.event, patch)
  }

  function handleEventMove(ev: AgendaEvent, newScheduledAt: string) {
    if (ev.kind !== 'booking') return
    const p = { event: ev, newScheduledAt }
    if (ev.booking.is_personal) applyReschedule(p, false)
    else setPendingReschedule(p)
  }

  function handleEventResize(ev: AgendaEvent, newDurationMinutes: number) {
    if (ev.kind !== 'booking') return
    const p = { event: ev, newScheduledAt: ev.booking.scheduled_at, newDurationMinutes }
    if (ev.booking.is_personal) applyReschedule(p, false)
    else setPendingReschedule(p)
  }

  async function importTemplate(templateId: string) {
    setImporting(true)
    try {
      await api.post(`/api/planning-templates/${templateId}/import`, {
        week_start: toDateInput(startOfWeek(currentDate)),
        timezone_offset: new Date().getTimezoneOffset(),
      })
      await refetch()
    } catch (err) {
      setActionError(err instanceof Error ? `Import du template échoué — ${err.message}` : 'Import du template échoué')
    } finally {
      setImporting(false)
    }
  }

  // Keyboard: Cmd/Ctrl+C copies the highlighted event, Cmd/Ctrl+V pastes it
  // at the hovered slot (snapped to :00/:30 like the web), Delete/Backspace
  // removes the highlighted/selected booking.
  const keyStateRef = useRef({ events, highlightedId, selectedEvent })
  keyStateRef.current = { events, highlightedId, selectedEvent }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      if (prefill || pendingReschedule) return
      const { events: evs, highlightedId: hid, selectedEvent: sel } = keyStateRef.current
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'c' && hid) {
        const ev = evs.find((x) => x.id === hid)
        if (ev) {
          e.preventDefault()
          copiedRef.current = ev
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'v' && copiedRef.current && hoverRef.current) {
        e.preventDefault()
        const src = copiedRef.current
        const { day, hour } = hoverRef.current
        const d = new Date(day)
        const h = Math.floor(hour)
        const m = Math.round((hour - h) * 60)
        const snapped = m < 15 ? 0 : m < 45 ? 30 : 60
        if (snapped === 60) d.setHours(h + 1, 0, 0, 0)
        else d.setHours(h, snapped, 0, 0)
        const b = src.kind === 'booking' ? src.booking : null
        api
          .post('/api/bookings', {
            is_personal: b?.is_personal ?? true,
            calendar_id: b?.calendar_id ?? null,
            lead_id: null,
            location_id: b?.location_id ?? null,
            title: src.title,
            scheduled_at: d.toISOString(),
            duration_minutes: src.durationMinutes,
            notes: b?.notes ?? null,
          })
          .then(() => refetch())
          .catch((err: unknown) => setActionError(err instanceof Error ? `Duplication échouée — ${err.message}` : 'Duplication échouée'))
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const target = sel ?? (hid ? evs.find((x) => x.id === hid) ?? null : null)
        if (!target || target.kind !== 'booking') return
        e.preventDefault()
        void deleteBooking(target, 'this')
      }
      if (e.key === 'Escape') {
        setHighlightedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // deleteBooking/refetch are stable enough; state is read through keyStateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, pendingReschedule, refetch])

  const noCalendars = data.calendarsLoaded && calendars.length === 0

  return (
    <div className="agenda-page">
      <div className="agenda-header">
        <div>
          <h1>Agenda</h1>
          <p>Rendez-vous, appels du pipeline et événements Google Calendar</p>
        </div>
        <div className="agenda-header-actions">
          {templates.length > 0 && (
            <select
              className="agenda-select"
              value=""
              disabled={importing}
              onChange={(e) => e.target.value && void importTemplate(e.target.value)}
              title="Importe les blocs du template sur la semaine affichée"
            >
              <option value="">{importing ? 'Import…' : 'Importer un template'}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="ds-pill-button" onClick={() => void openWeb('/agenda/templates')}>
            Templates ↗
          </button>
          <button
            type="button"
            className="ds-pill-button ds-pill-button--dark"
            onClick={() =>
              setPrefill({ date: toDateInput(currentDate), time: '09:00', duration: DEFAULT_NEW_DURATION })
            }
          >
            + Nouveau RDV
          </button>
        </div>
      </div>

      <div className="agenda-toolbar">
        <Tabs items={VIEW_TABS} active={view} onChange={setView} />
        <div className="agenda-nav">
          <button type="button" className="agenda-nav-arrow" aria-label="Période précédente" onClick={() => setCurrentDate((d) => navigateDate(view, d, -1))}>
            ‹
          </button>
          <button type="button" className="ds-pill-button" onClick={() => setCurrentDate(new Date())}>
            Aujourd’hui
          </button>
          <button type="button" className="agenda-nav-arrow" aria-label="Période suivante" onClick={() => setCurrentDate((d) => navigateDate(view, d, 1))}>
            ›
          </button>
        </div>
        <span className="agenda-period">
          {periodLabel}
          {data.loading && <span className="agenda-loading-dot">chargement…</span>}
        </span>
        <FilterMenu label="Affichage" options={filterOptions} selected={visibleKeys} onChange={applyVisibility} />
      </div>

      {data.syncError && (
        <div className="agenda-banner" role="alert">
          <span>{data.syncError}</span>
          <button type="button" onClick={data.dismissSyncError}>
            Fermer
          </button>
        </div>
      )}
      {actionError && (
        <div className="agenda-banner" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}

      {noCalendars ? (
        <div>
          <EmptyState title="Aucun calendrier configuré" description="Crée ton premier calendrier de réservation pour commencer." />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => routerNavigate('/agenda/pages')}>
              Configurer un calendrier
            </Button>
          </div>
        </div>
      ) : data.error && events.length === 0 ? (
        <ErrorState message={data.error} onRetry={() => void refetch()} />
      ) : !data.calendarsLoaded ? (
        <LoadingState />
      ) : view === 'month' ? (
        <MonthView
          date={currentDate}
          events={filtered}
          highlightedId={highlightedId}
          onEventClick={handleEventClick}
          onDayClick={(d) => {
            setCurrentDate(d)
            setView('day')
          }}
        />
      ) : view === 'list' ? (
        <ListView
          events={filtered}
          periodLabel={periodLabel}
          onEventClick={(ev) => {
            setHighlightedId(ev.id)
            setSelectedId(ev.id)
          }}
        />
      ) : (
        <TimeGridView
          days={days}
          events={filtered}
          highlightedId={highlightedId}
          onEventClick={handleEventClick}
          onSlotCreate={handleSlotCreate}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onHoverChange={handleHoverChange}
          onDayHeaderClick={(d) => {
            setCurrentDate(d)
            setView('day')
          }}
        />
      )}

      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          onClose={() => setSelectedId(null)}
          onSave={(ev, patch) => void saveBooking(ev, patch)}
          onStatusChange={(ev, s) => void changeStatus(ev, s)}
          onDelete={(ev, scope) => void deleteBooking(ev, scope)}
        />
      )}

      {pendingReschedule && (
        <div
          className="lead-create-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPendingReschedule(null)
          }}
        >
          <div className="lead-create-modal">
            <h2>Modifier l’horaire du rendez-vous ?</h2>
            <p className="ds-muted" style={{ marginTop: 0 }}>
              {pendingReschedule.event.title} — {formatDateTime(pendingReschedule.newScheduledAt)}
              {pendingReschedule.newDurationMinutes ? ` (${pendingReschedule.newDurationMinutes} min)` : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="primary"
                onClick={() => {
                  applyReschedule(pendingReschedule, true)
                  setPendingReschedule(null)
                }}
              >
                Modifier et prévenir le prospect par email
              </Button>
              <Button
                onClick={() => {
                  applyReschedule(pendingReschedule, false)
                  setPendingReschedule(null)
                }}
              >
                Modifier sans prévenir
              </Button>
              <Button variant="ghost" onClick={() => setPendingReschedule(null)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {prefill && (
        <BookingModal
          calendars={calendars}
          locations={locations}
          prefillDate={prefill.date}
          prefillTime={prefill.time}
          prefillDuration={prefill.duration}
          onClose={() => setPrefill(null)}
          onCreated={() => {
            setPrefill(null)
            void refetch()
          }}
        />
      )}
    </div>
  )
}
