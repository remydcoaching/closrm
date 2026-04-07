'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { isSameDay, isToday, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

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

function getBookingPosition(booking: BookingWithCalendar) {
  const d = parseISO(booking.scheduled_at)
  const hour = getHours(d)
  const minutes = getMinutes(d)
  const top = (hour - START_HOUR) * CELL_HEIGHT + (minutes / 60) * CELL_HEIGHT
  const height = Math.max((booking.duration_minutes / 60) * CELL_HEIGHT, 20)
  return { top, height }
}

interface DragState {
  startSlot: number
  currentSlot: number
}

export function DayView({ date, bookings, onBookingClick, onSlotSelect, onBookingDrop }: DayViewProps) {
  const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), date))
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
            {dayBookings.map((b) => {
              const pos = getBookingPosition(b)
              return (
                <BookingBlock
                  key={b.id}
                  booking={b}
                  onClick={onBookingClick}
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
