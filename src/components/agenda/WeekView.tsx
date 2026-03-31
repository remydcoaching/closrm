'use client'

import { startOfWeek, addDays, isSameDay, isToday, parseISO, format, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface WeekViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
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

export function WeekView({ date, bookings, onBookingClick, onSlotClick }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const GRID_BORDER = '1px solid var(--agenda-grid-border, rgba(128,128,128,0.15))'
  const HOUR_COL_WIDTH = 72

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', position: 'relative' }}>
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
                height: CELL_HEIGHT, padding: '0 10px 0 0', textAlign: 'right', fontSize: 11, fontWeight: 500,
                color: 'var(--text-secondary)', borderRight: GRID_BORDER,
                borderBottom: GRID_BORDER,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 4,
              }}>
                {String(hour).padStart(2, '0')}:00
              </div>
              {days.map((day) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickY = e.clientY - rect.top
                    const minutes = clickY < CELL_HEIGHT / 2 ? 0 : 30
                    onSlotClick(day, hour + minutes / 60)
                  }}
                  style={{
                    height: CELL_HEIGHT, position: 'relative', cursor: 'pointer',
                    borderRight: GRID_BORDER,
                    borderBottom: GRID_BORDER,
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                />
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
