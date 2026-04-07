'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, LayoutTemplate } from 'lucide-react'
import { BookingWithCalendar, BookingCalendar, BookingLocation, PlanningTemplate } from '@/types'
import { AgendaSidebar } from '@/components/agenda/AgendaSidebar'
import { FilterPanel } from '@/components/agenda/FilterPanel'
import { DayView } from '@/components/agenda/DayView'
import { WeekView } from '@/components/agenda/WeekView'
import { MonthView } from '@/components/agenda/MonthView'
import NewBookingModal from '@/components/agenda/NewBookingModal'
import { BookingDetailPanel } from '@/components/agenda/BookingDetailPanel'

type ViewMode = 'day' | 'week' | 'month'

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
}

function getDateRange(viewMode: ViewMode, date: Date): { start: Date; end: Date } {
  if (viewMode === 'day') {
    return { start: date, end: date }
  }
  if (viewMode === 'week') {
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    }
  }
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  }
}

function formatHeaderDate(viewMode: ViewMode, date: Date): string {
  if (viewMode === 'day') {
    return format(date, 'EEEE d MMMM yyyy', { locale: fr })
  }
  if (viewMode === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    const end = endOfWeek(date, { weekStartsOn: 1 })
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'd')} – ${format(end, 'd MMMM yyyy', { locale: fr })}`
    }
    return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
  }
  return format(date, 'MMMM yyyy', { locale: fr })
}

export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [bookings, setBookings] = useState<BookingWithCalendar[]>([])
  const [calendars, setCalendars] = useState<BookingCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [showPersonal, setShowPersonal] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [modalPrefill, setModalPrefill] = useState({ date: '', time: '', duration: 60 })
  const [selectedBooking, setSelectedBooking] = useState<BookingWithCalendar | null>(null)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'bookings' | 'blocked'>('all')
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [templates, setTemplates] = useState<PlanningTemplate[]>([])
  const [moveConfirm, setMoveConfirm] = useState<{ bookingId: string; booking: BookingWithCalendar | null; newDate: string; newTime: string } | null>(null)
  const [showImportDropdown, setShowImportDropdown] = useState(false)

  // Fetch calendars once on mount
  const fetchCalendars = useCallback(async () => {
    const res = await fetch('/api/booking-calendars')
    if (res.ok) {
      const json = await res.json()
      const data: BookingCalendar[] = json.data ?? []
      setCalendars(data)
      setVisibleCalendarIds(new Set(data.map((c) => c.id)))
    }
    const locRes = await fetch('/api/booking-locations')
    if (locRes.ok) {
      const locJson = await locRes.json()
      setLocations(locJson.data || [])
    }
    const tplRes = await fetch('/api/planning-templates')
    if (tplRes.ok) {
      const tplJson = await tplRes.json()
      setTemplates(tplJson.data || [])
    }
  }, [])

  useEffect(() => {
    fetchCalendars()
  }, [fetchCalendars])

  // Trigger Google Calendar sync in background (fire-and-forget, once on mount)
  useEffect(() => {
    fetch('/api/integrations/google/sync', { method: 'POST' }).catch(() => {})
  }, [])

  // Fetch bookings + calls when viewMode or currentDate changes
  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(viewMode, currentDate)
    const params = new URLSearchParams({
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      per_page: '100',
    })

    const [bookingsRes, callsRes] = await Promise.all([
      fetch(`/api/bookings?${params.toString()}`),
      fetch(`/api/calls?scheduled_after=${start.toISOString()}&scheduled_before=${end.toISOString()}&per_page=100`),
    ])

    const allItems: BookingWithCalendar[] = []

    if (bookingsRes.ok) {
      const json = await bookingsRes.json()
      allItems.push(...(json.data ?? []))
    }

    // Convert calls to BookingWithCalendar format
    if (callsRes.ok) {
      const json = await callsRes.json()
      const calls = json.data ?? []
      for (const call of calls) {
        // Skip calls that already have a linked booking (avoid duplicates)
        if (allItems.some((b) => b.call_id === call.id)) continue

        const callColor = call.type === 'setting' ? '#3b82f6' : '#a855f7'
        const callLabel = call.type === 'setting' ? 'Setting' : 'Closing'
        const leadName = call.lead
          ? `${call.lead.first_name} ${call.lead.last_name}`.trim()
          : 'Appel'

        allItems.push({
          id: `call-${call.id}`,
          workspace_id: call.workspace_id,
          calendar_id: null,
          lead_id: call.lead_id,
          call_id: call.id,
          title: `${callLabel} — ${leadName}`,
          scheduled_at: call.scheduled_at,
          duration_minutes: call.duration_seconds ? Math.ceil(call.duration_seconds / 60) : 30,
          status: call.outcome === 'done' ? 'completed' : call.outcome === 'cancelled' ? 'cancelled' : call.outcome === 'no_show' ? 'no_show' : 'confirmed',
          source: 'manual',
          form_data: {},
          notes: call.notes,
          google_event_id: null,
          is_personal: false,
          location_id: null,
          created_at: call.created_at,
          booking_calendar: { name: callLabel, color: callColor },
          lead: call.lead ?? null,
          location: null,
        })
      }
    }

    setBookings(allItems)
    setLoading(false)
  }, [viewMode, currentDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Keyboard shortcut: Backspace/Delete to remove selected booking
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBooking) {
        e.preventDefault()
        if (confirm(`Supprimer "${selectedBooking.title}" ?`)) {
          handleDeleteBooking(selectedBooking.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBooking]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
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

  // Calendar visibility toggles
  function toggleCalendar(id: string) {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Slot click → open modal with prefill
  function handleSlotSelect(date: Date, startHour: number, endHour: number) {
    const h = Math.floor(startHour)
    const m = Math.round((startHour - h) * 60)
    const durationMinutes = Math.round((endHour - startHour) * 60)
    setModalPrefill({
      date: format(date, 'yyyy-MM-dd'),
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      duration: durationMinutes > 0 ? durationMinutes : 30,
    })
    setShowNewModal(true)
  }

  // Drag & drop — booking move
  function handleBookingDrop(bookingId: string, newDate: Date, newHour: number) {
    const h = Math.floor(newHour)
    const m = Math.round((newHour - h) * 60)
    const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const newDateStr = format(newDate, 'yyyy-MM-dd')
    const booking = bookings.find(b => b.id === bookingId) || null
    setMoveConfirm({ bookingId, booking, newDate: newDateStr, newTime })
  }

  async function confirmMove(sendEmail: boolean) {
    if (!moveConfirm) return
    const scheduled_at = new Date(`${moveConfirm.newDate}T${moveConfirm.newTime}:00`).toISOString()

    // Check if it's a call (id starts with "call-")
    const isCall = moveConfirm.bookingId.startsWith('call-')
    const realId = isCall ? moveConfirm.bookingId.replace('call-', '') : moveConfirm.bookingId
    const url = isCall ? `/api/calls/${realId}` : `/api/bookings/${realId}`

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      console.error('[Move] Failed:', res.status, json)
      alert(`Erreur: ${typeof json?.error === 'string' ? json.error : 'Impossible de déplacer le RDV'}`)
    }

    // TODO: send email notification if sendEmail is true
    setMoveConfirm(null)
    fetchBookings()
  }

  // Import template
  async function handleImportTemplate(templateId: string) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const res = await fetch(`/api/planning-templates/${templateId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_start: format(weekStart, 'yyyy-MM-dd'), timezone_offset: new Date().getTimezoneOffset() }),
    })
    if (res.ok) {
      fetchBookings()
    }
    setShowImportDropdown(false)
  }

  // Delete booking
  async function handleDeleteBooking(id: string) {
    await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
    setSelectedBooking(null)
    fetchBookings()
  }

  // Status change
  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    // Refresh both list and selected booking
    const res = await fetch(`/api/bookings/${id}`)
    if (res.ok) {
      const json = await res.json()
      setSelectedBooking(json.data)
      setBookings((prev) => prev.map((b) => (b.id === id ? json.data : b)))
    }
  }

  // Filter bookings based on visibility settings and filter type
  const filteredBookings = bookings.filter((b) => {
    if (filterType === 'bookings' && b.is_personal) return false
    if (filterType === 'blocked' && !b.is_personal) return false
    if (b.is_personal) return showPersonal
    if (b.calendar_id) return visibleCalendarIds.has(b.calendar_id)
    return true
  })

  const headerDateLabel = formatHeaderDate(viewMode, currentDate)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }} onClick={() => setShowImportDropdown(false)}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            borderBottom: '2px solid var(--border-secondary)',
            background: 'var(--bg-primary)',
            flexShrink: 0,
          }}
        >
          {/* View mode tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-secondary)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => {
              const active = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: active ? 'var(--border-secondary)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {VIEW_LABELS[mode]}
                </button>
              )
            })}
          </div>

          {/* Navigation */}
          <button
            onClick={navigatePrev}
            style={{
              background: 'none',
              border: '1px solid var(--border-secondary)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '5px 6px',
            }}
            aria-label="Précédent"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={navigateToday}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-secondary)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Aujourd&apos;hui
          </button>

          <button
            onClick={navigateNext}
            style={{
              background: 'none',
              border: '1px solid var(--border-secondary)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '5px 6px',
            }}
            aria-label="Suivant"
          >
            <ChevronRight size={16} />
          </button>

          {/* Date title */}
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              textTransform: 'capitalize',
              flex: 1,
            }}
          >
            {headerDateLabel}
          </span>

          {/* Templates link */}
          <a
            href="/agenda/templates"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-secondary)', borderRadius: 8,
              fontSize: 13, textDecoration: 'none', cursor: 'pointer',
            }}
          >
            <LayoutTemplate size={14} /> Templates
          </a>

          {/* Import template dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowImportDropdown(!showImportDropdown) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: showImportDropdown ? 'rgba(229,62,62,0.1)' : 'var(--bg-secondary)',
                color: showImportDropdown ? '#E53E3E' : 'var(--text-secondary)',
                border: `1px solid ${showImportDropdown ? '#E53E3E' : 'var(--border-secondary)'}`,
                borderRadius: 8, fontSize: 13, cursor: 'pointer',
              }}
            >
              <LayoutTemplate size={14} /> Importer
            </button>
            {showImportDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
                  borderRadius: 8, padding: 4, zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                {templates.length === 0 && (
                  <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Aucun template. <a href="/agenda/templates" style={{ color: 'var(--color-primary, #E53E3E)' }}>Créer un template</a>
                  </div>
                )}
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleImportTemplate(t.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                      background: 'transparent', border: 'none', borderRadius: 6,
                      color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {t.blocks.length} blocs
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter panel toggle */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: showFilterPanel ? 'var(--bg-active)' : 'var(--bg-secondary)',
              color: showFilterPanel ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: `1px solid ${showFilterPanel ? 'var(--color-primary)' : 'var(--border-secondary)'}`,
              borderRadius: 8, fontSize: 13, cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} /> Gérer l&apos;affichage
          </button>

          {/* New booking button */}
          <button
            onClick={() => {
              setModalPrefill({ date: format(currentDate, 'yyyy-MM-dd'), time: '09:00', duration: 60 })
              setShowNewModal(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Nouveau RDV
          </button>
        </div>

        {/* Calendar view */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--color-primary)',
                zIndex: 20,
              }}
            />
          )}

          {viewMode === 'day' && (
            <DayView
              date={currentDate}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onSlotSelect={handleSlotSelect}
              onBookingDrop={handleBookingDrop}
            />
          )}

          {viewMode === 'week' && (
            <WeekView
              date={currentDate}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onSlotSelect={handleSlotSelect}
              onBookingDrop={handleBookingDrop}
            />
          )}

          {viewMode === 'month' && (
            <MonthView
              date={currentDate}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onDayClick={(d) => {
                setCurrentDate(d)
                setViewMode('day')
              }}
            />
          )}
        </div>
      </div>

      {/* Filter panel */}
      <FilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        calendars={calendars}
        visibleCalendarIds={visibleCalendarIds}
        onToggleCalendar={toggleCalendar}
        showPersonal={showPersonal}
        onTogglePersonal={() => setShowPersonal((p) => !p)}
      />

      {/* Detail panel */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onDelete={handleDeleteBooking}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* New booking modal */}
      {showNewModal && (
        <NewBookingModal
          calendars={calendars}
          locations={locations}
          prefillDate={modalPrefill.date}
          prefillTime={modalPrefill.time}
          prefillDuration={modalPrefill.duration}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            fetchBookings()
          }}
        />
      )}

      {/* Move confirmation popup */}
      {moveConfirm && (
        <div
          onClick={() => setMoveConfirm(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
              borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw',
            }}
          >
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Déplacer le rendez-vous ?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
              <strong>{moveConfirm.booking?.title || 'Ce RDV'}</strong>
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 20 }}>
              Nouvelle heure : {moveConfirm.newDate} à {moveConfirm.newTime}
            </p>

            {moveConfirm.booking?.lead && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 20 }}>
                Voulez-vous envoyer un email à {moveConfirm.booking.lead.first_name} pour le prévenir du changement ?
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMoveConfirm(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13,
                  background: 'transparent', border: '1px solid var(--border-secondary)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              {moveConfirm.booking?.lead && (
                <button
                  onClick={() => confirmMove(true)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                  }}
                >
                  Déplacer + envoyer email
                </button>
              )}
              <button
                onClick={() => confirmMove(false)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary, #E53E3E)', border: 'none',
                  color: '#fff', cursor: 'pointer',
                }}
              >
                {moveConfirm.booking?.lead ? 'Déplacer sans email' : 'Déplacer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
