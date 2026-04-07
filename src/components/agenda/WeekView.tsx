'use client'

import { useState, useCallback, useRef } from 'react'
import { startOfWeek, addDays, isSameDay, isToday, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface WeekViewProps {
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
const HALF_SLOTS = HOURS.flatMap((h) => [h, h + 0.5])

function getBookingPosition(booking: BookingWithCalendar) {
  const d = parseISO(booking.scheduled_at)
  const hour = getHours(d)
  const minutes = getMinutes(d)
  const top = (hour - START_HOUR) * CELL_HEIGHT + (minutes / 60) * CELL_HEIGHT
  const height = Math.max((booking.duration_minutes / 60) * CELL_HEIGHT, 20)
  return { top, height }
}

function resolveOverlaps(bookings: BookingWithCalendar[]): (BookingWithCalendar & { col: number; totalCols: number })[] {
  if (bookings.length === 0) return []
  const sorted = [...bookings].sort((a, b) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  const result: (BookingWithCalendar & { col: number; totalCols: number })[] = []
  const groups: BookingWithCalendar[][] = []

  for (const b of sorted) {
    const bStart = new Date(b.scheduled_at).getTime()
    let placed = false
    for (const group of groups) {
      const lastInGroup = group[group.length - 1]
      const lastEnd = new Date(lastInGroup.scheduled_at).getTime() + lastInGroup.duration_minutes * 60000
      if (bStart >= lastEnd) {
        group.push(b)
        placed = true
        break
      }
    }
    if (!placed) groups.push([b])
  }

  const totalCols = groups.length
  for (let col = 0; col < groups.length; col++) {
    for (const b of groups[col]) {
      result.push({ ...b, col, totalCols })
    }
  }
  return result
}

interface DragState {
  dayIdx: number
  startSlot: number // e.g. 10, 10.5, 11
  currentSlot: number
}

export function WeekView({ date, bookings, onBookingClick, onSlotSelect, onBookingDrop }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)

  const GRID_BORDER = '1px solid var(--agenda-grid-border, rgba(128,128,128,0.15))'
  const HOUR_COL_WIDTH = 72

  const handleMouseDown = useCallback((dayIdx: number, slot: number) => {
    isDragging.current = true
    setDrag({ dayIdx, startSlot: slot, currentSlot: slot })
  }, [])

  const handleMouseEnter = useCallback((dayIdx: number, slot: number) => {
    if (!isDragging.current || !drag) return
    if (dayIdx !== drag.dayIdx) return // only drag within same day
    setDrag((prev) => prev ? { ...prev, currentSlot: slot } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) {
      isDragging.current = false
      setDrag(null)
      return
    }
    isDragging.current = false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot) + 0.5 // end is exclusive, add 30min
    setDrag(null)
    onSlotSelect(days[drag.dayIdx], start, end)
  }, [drag, days, onSlotSelect])

  // Check if a half-slot is within the drag selection
  function isSlotInDrag(dayIdx: number, slot: number): boolean {
    if (!drag || dayIdx !== drag.dayIdx) return false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot)
    return slot >= start && slot <= end
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', position: 'relative', userSelect: 'none' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp() }}
    >
      {/* Sticky header */}
      <div style={{
        display: 'grid', gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)`,
        borderBottom: '2px solid var(--border-secondary)', position: 'sticky', top: 0,
        zIndex: 5, background: 'var(--bg-primary)',
      }}>
        <div style={{ borderRight: GRID_BORDER }} />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div key={day.toISOString()} style={{
              textAlign: 'center', padding: '10px 0 8px',
              borderRight: GRID_BORDER,
              background: today ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: today ? 'var(--color-primary)' : 'var(--text-secondary)',
              }}>
                {format(day, 'EEE', { locale: fr })}
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '4px auto 0', fontSize: 16, fontWeight: 600,
                background: today ? 'var(--color-primary)' : 'transparent',
                color: today ? '#fff' : 'var(--text-primary)',
              }}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid + bookings overlay */}
      <div style={{ position: 'relative' }}>
        {/* Grid lines */}
        <div style={{ display: 'grid', gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)` }}>
          {HOURS.map((hour) => (
            <div key={hour} style={{ display: 'contents' }}>
              <div style={{
                height: CELL_HEIGHT, textAlign: 'right', fontSize: 11, fontWeight: 500,
                color: 'var(--text-secondary)', borderRight: GRID_BORDER,
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', bottom: -8, right: 10, lineHeight: 1, background: 'var(--bg-primary)', paddingTop: 2, paddingBottom: 2 }}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {days.map((day, dayIdx) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  style={{
                    height: CELL_HEIGHT, position: 'relative', cursor: 'pointer',
                    borderRight: GRID_BORDER,
                    borderBottom: GRID_BORDER,
                  }}
                >
                  {/* Top half — :00 */}
                  <div
                    onMouseDown={() => handleMouseDown(dayIdx, hour)}
                    onMouseEnter={() => handleMouseEnter(dayIdx, hour)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const bookingId = e.dataTransfer.getData('bookingId')
                      if (bookingId && onBookingDrop) onBookingDrop(bookingId, days[dayIdx], hour)
                    }}
                    style={{
                      height: '50%',
                      borderBottom: '1px dashed rgba(128,128,128,0.08)',
                      background: isSlotInDrag(dayIdx, hour)
                        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                        : 'transparent',
                      transition: 'background 0.05s',
                    }}
                  />
                  {/* Bottom half — :30 */}
                  <div
                    onMouseDown={() => handleMouseDown(dayIdx, hour + 0.5)}
                    onMouseEnter={() => handleMouseEnter(dayIdx, hour + 0.5)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const bookingId = e.dataTransfer.getData('bookingId')
                      if (bookingId && onBookingDrop) onBookingDrop(bookingId, days[dayIdx], hour + 0.5)
                    }}
                    style={{
                      height: '50%',
                      background: isSlotInDrag(dayIdx, hour + 0.5)
                        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                        : 'transparent',
                      transition: 'background 0.05s',
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bookings overlay */}
        <div style={{
          position: 'absolute', top: 0, left: HOUR_COL_WIDTH, right: 0, bottom: 0,
          pointerEvents: 'none', height: TOTAL_HEIGHT,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
            {days.map((day) => {
              const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), day))
              const positioned = resolveOverlaps(dayBookings)
              return (
                <div key={day.toISOString()} style={{ position: 'relative', pointerEvents: 'none' }}>
                  {positioned.map((b) => {
                    const pos = getBookingPosition(b)
                    const width = 100 / b.totalCols
                    const left = width * b.col
                    return (
                      <BookingBlock
                        key={b.id}
                        booking={b}
                        onClick={onBookingClick}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `${left}%`,
                          width: `calc(${width}% - 4px)`,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
