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
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { BookingWithCalendar, BookingCalendar } from '@/types'
import { AgendaSidebar } from '@/components/agenda/AgendaSidebar'
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
  const [modalPrefill, setModalPrefill] = useState({ date: '', time: '' })
  const [selectedBooking, setSelectedBooking] = useState<BookingWithCalendar | null>(null)

  // Fetch calendars once on mount
  const fetchCalendars = useCallback(async () => {
    const res = await fetch('/api/booking-calendars')
    if (res.ok) {
      const json = await res.json()
      const data: BookingCalendar[] = json.data ?? []
      setCalendars(data)
      setVisibleCalendarIds(new Set(data.map((c) => c.id)))
    }
  }, [])

  useEffect(() => {
    fetchCalendars()
  }, [fetchCalendars])

  // Fetch bookings when viewMode or currentDate changes
  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(viewMode, currentDate)
    const params = new URLSearchParams({
      date_start: start.toISOString(),
      date_end: end.toISOString(),
      per_page: '100',
    })
    const res = await fetch(`/api/bookings?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setBookings(json.data ?? [])
    }
    setLoading(false)
  }, [viewMode, currentDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

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
  function handleSlotClick(date: Date, hour: number) {
    setModalPrefill({
      date: format(date, 'yyyy-MM-dd'),
      time: `${String(hour).padStart(2, '0')}:00`,
    })
    setShowNewModal(true)
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

  // Filter bookings based on visibility settings
  const filteredBookings = bookings.filter((b) => {
    if (b.is_personal) return showPersonal
    if (b.calendar_id) return visibleCalendarIds.has(b.calendar_id)
    return true
  })

  const headerDateLabel = formatHeaderDate(viewMode, currentDate)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AgendaSidebar
        selectedDate={currentDate}
        onDateSelect={(d) => {
          setCurrentDate(d)
          setViewMode('day')
        }}
        calendars={calendars}
        visibleCalendarIds={visibleCalendarIds}
        onToggleCalendar={toggleCalendar}
        showPersonal={showPersonal}
        onTogglePersonal={() => setShowPersonal((v) => !v)}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderBottom: '1px solid #262626',
            background: '#0A0A0A',
            flexShrink: 0,
          }}
        >
          {/* View mode tabs */}
          <div
            style={{
              display: 'flex',
              background: '#141414',
              border: '1px solid #262626',
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
                    background: active ? '#262626' : 'transparent',
                    color: active ? '#FFFFFF' : '#A0A0A0',
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
              border: '1px solid #262626',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#A0A0A0',
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
              border: '1px solid #262626',
              background: 'transparent',
              color: '#A0A0A0',
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
              border: '1px solid #262626',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#A0A0A0',
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
              color: '#FFFFFF',
              textTransform: 'capitalize',
              flex: 1,
            }}
          >
            {headerDateLabel}
          </span>

          {/* New booking button */}
          <button
            onClick={() => {
              setModalPrefill({ date: format(currentDate, 'yyyy-MM-dd'), time: '09:00' })
              setShowNewModal(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#E53E3E',
              color: '#FFFFFF',
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
                background: 'rgba(229,62,62,0.4)',
                zIndex: 20,
              }}
            />
          )}

          {viewMode === 'day' && (
            <DayView
              date={currentDate}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onSlotClick={handleSlotClick}
            />
          )}

          {viewMode === 'week' && (
            <WeekView
              date={currentDate}
              bookings={filteredBookings}
              onBookingClick={setSelectedBooking}
              onSlotClick={handleSlotClick}
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
          prefillDate={modalPrefill.date}
          prefillTime={modalPrefill.time}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            fetchBookings()
          }}
        />
      )}
    </div>
  )
}
