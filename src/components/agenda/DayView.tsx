'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { isToday, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'
import {
  getBookingSegmentsForDay,
  isAllDayBooking,
  bookingTouchesDay,
  type BookingDaySegment,
} from '@/lib/bookings/multi-day'

interface DayViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotSelect: (date: Date, startHour: number, endHour: number) => void
  onBookingDrop?: (bookingId: string, newDate: Date, newHour: number) => void
}

const CELL_HEIGHT = 60
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)
const TOTAL_HEIGHT = HOURS.length * CELL_HEIGHT

function getSegmentPosition(seg: BookingDaySegment) {
  const visStart = Math.max(seg.startHour, START_HOUR)
  const visEnd = Math.min(seg.endHour, END_HOUR)
  const top = (visStart - START_HOUR) * CELL_HEIGHT
  const height = Math.max((visEnd - visStart) * CELL_HEIGHT, 20)
  return { top, height }
}

interface DragState {
  startSlot: number
  currentSlot: number
}

export function DayView({ date, bookings, onBookingClick, onSlotSelect, onBookingDrop }: DayViewProps) {
  // Sépare les bookings "toute la journée" / multi-jours pour les rendre dans
  // une lane en haut (à la Google Calendar). Les bookings horaires gardent
  // leur position dans la grille.
  const allDayForThisDay = bookings.filter((b) => isAllDayBooking(b) && bookingTouchesDay(b, date))
  const hourlyBookings = bookings.filter((b) => !isAllDayBooking(b))
  const daySegments = getBookingSegmentsForDay(hourlyBookings, date)
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Current time indicator
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (containerRef.current && isToday(date)) {
      const currentHour = new Date().getHours()
      const scrollTop = Math.max((currentHour - START_HOUR - 1) * CELL_HEIGHT, 0)
      containerRef.current.scrollTop = scrollTop
    }
  }, [date])

  const showTimeLine = isToday(date)
  const currentTimeTop = showTimeLine
    ? (now.getHours() - START_HOUR) * CELL_HEIGHT + (now.getMinutes() / 60) * CELL_HEIGHT
    : -1

  const GRID_BORDER = '1px solid var(--agenda-grid-border, rgba(128,128,128,0.15))'
  const HOUR_COL_WIDTH = 72

  const handleMouseDown = useCallback((slot: number) => {
    isDragging.current = true
    setDrag({ startSlot: slot, currentSlot: slot })
  }, [])

  const handleMouseEnter = useCallback((slot: number) => {
    if (!isDragging.current) return
    setDrag((prev) => prev ? { ...prev, currentSlot: slot } : null)
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) {
      isDragging.current = false
      setDrag(null)
      return
    }
    isDragging.current = false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot) + 0.5
    setDrag(null)
    onSlotSelect(date, start, end)
  }, [drag, date, onSlotSelect])

  function isSlotInDrag(slot: number): boolean {
    if (!drag) return false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot)
    return slot >= start && slot <= end
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', userSelect: 'none' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp() }}
    >
      {/* Day header */}
      <div style={{
        textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 600,
        color: 'var(--text-primary)', borderBottom: '2px solid var(--border-secondary)',
        textTransform: 'capitalize', position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--bg-primary)',
      }}>
        {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
      </div>

      {/* Lane "Toute la journée" — barre horizontale en haut pour les
          évènements multi-jours / all-day qui touchent ce jour. */}
      {allDayForThisDay.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-secondary)',
          background: 'var(--bg-primary)',
        }}>
          {allDayForThisDay.map((b) => {
            const color = b.is_personal
              ? (b.form_data?.color as string) || '#6b7280'
              : b.booking_calendar?.color || '#3b82f6'
            const displayTitle = b.is_personal
              ? b.title
              : (b.lead ? `${b.lead.first_name} ${b.lead.last_name}`.trim() : b.title)
            const totalDays = Math.max(1, Math.round(b.duration_minutes / 1440))
            const isFree = b.blocks_availability === false
            const bg = isFree
              ? `repeating-linear-gradient(135deg, ${color}33 0 8px, ${color}10 8px 16px)`
              : `${color}33`
            return (
              <div
                key={b.id}
                onClick={() => onBookingClick(b)}
                style={{
                  marginLeft: HOUR_COL_WIDTH,
                  background: bg,
                  borderLeft: `3px ${isFree ? 'dashed' : 'solid'} ${color}`,
                  color: 'var(--text-primary)',
                  fontSize: 12, fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayTitle}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {totalDays > 1 ? `${totalDays} jours` : 'Toute la journée'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div style={{ position: 'relative', flex: 1 }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            style={{
              display: 'flex', height: CELL_HEIGHT, cursor: 'pointer',
              borderBottom: GRID_BORDER,
            }}
          >
            <div style={{
              width: HOUR_COL_WIDTH, flexShrink: 0, textAlign: 'right',
              fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
              borderRight: GRID_BORDER, position: 'relative',
            }}>
              <span style={{ position: 'absolute', top: -8, right: 10, lineHeight: 1, background: 'var(--bg-primary)', paddingTop: 2, paddingBottom: 2 }}>
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                onMouseDown={() => handleMouseDown(hour)}
                onMouseEnter={() => handleMouseEnter(hour)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={(e) => {
                  e.preventDefault()
                  const bookingId = e.dataTransfer.getData('bookingId')
                  if (bookingId && onBookingDrop) onBookingDrop(bookingId, date, hour)
                }}
                style={{
                  height: '50%',
                  borderBottom: '1px dashed rgba(128,128,128,0.08)',
                  background: isSlotInDrag(hour)
                    ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                    : 'transparent',
                  transition: 'background 0.05s',
                }}
              />
              <div
                onMouseDown={() => handleMouseDown(hour + 0.5)}
                onMouseEnter={() => handleMouseEnter(hour + 0.5)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={(e) => {
                  e.preventDefault()
                  const bookingId = e.dataTransfer.getData('bookingId')
                  if (bookingId && onBookingDrop) onBookingDrop(bookingId, date, hour + 0.5)
                }}
                style={{
                  height: '50%',
                  background: isSlotInDrag(hour + 0.5)
                    ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                    : 'transparent',
                  transition: 'background 0.05s',
                }}
              />
            </div>
          </div>
        ))}

        {/* Bookings overlay */}
        <div style={{ position: 'absolute', top: 0, left: HOUR_COL_WIDTH, right: 0, height: TOTAL_HEIGHT, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}>
            {daySegments.map((seg) => {
              const pos = getSegmentPosition(seg)
              const isContinuation = !seg.isFirstDay
              const displayBooking = isContinuation
                ? { ...seg.booking, title: `${seg.booking.title} (suite)` }
                : seg.booking
              return (
                <BookingBlock
                  key={`${seg.booking.id}-${date.toISOString()}`}
                  booking={displayBooking}
                  onClick={() => onBookingClick(seg.booking)}
                  style={{ top: pos.top, height: pos.height, left: 4, right: 4 }}
                />
              )
            })}
            {/* Current time indicator */}
            {showTimeLine && currentTimeTop >= 0 && currentTimeTop <= TOTAL_HEIGHT && (
              <div
                style={{
                  position: 'absolute',
                  top: currentTimeTop,
                  left: 0,
                  right: 0,
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: -5,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                  }}
                />
                <div
                  style={{
                    height: 2,
                    background: 'var(--color-primary)',
                    width: '100%',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
