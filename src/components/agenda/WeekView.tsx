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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', position: 'relative' }}>
      {/* Sticky header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)',
        borderBottom: '1px solid var(--border-secondary)', position: 'sticky', top: 0,
        zIndex: 5, background: 'var(--bg-primary)',
      }}>
        <div style={{ borderRight: '1px solid var(--border-secondary)' }} />
        {days.map((day) => (
          <div key={day.toISOString()} style={{
            textAlign: 'center', padding: '8px 0',
            borderRight: '1px solid var(--border-secondary)',
          }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: isToday(day) ? '#E53E3E' : 'var(--text-muted)' }}>
              {format(day, 'EEE', { locale: fr })}
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '2px auto 0', fontSize: 15, fontWeight: 600,
              background: isToday(day) ? '#E53E3E' : 'transparent',
              color: isToday(day) ? '#fff' : 'var(--text-primary)',
            }}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid + bookings overlay */}
      <div style={{ position: 'relative' }}>
        {/* Grid lines */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          {HOURS.map((hour) => (
            <div key={hour} style={{ display: 'contents' }}>
              <div style={{
                height: CELL_HEIGHT, padding: '0 8px 0 0', textAlign: 'right', fontSize: 10,
                color: 'var(--text-muted)', borderRight: '1px solid var(--border-secondary)',
                borderBottom: '1px solid var(--border-secondary)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 2,
              }}>
                {String(hour).padStart(2, '0')}:00
              </div>
              {days.map((day) => (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onClick={() => onSlotClick(day, hour)}
                  style={{
                    height: CELL_HEIGHT, position: 'relative', cursor: 'pointer',
                    borderRight: '1px solid var(--border-secondary)',
                    borderBottom: '1px solid var(--border-secondary)',
                    background: isToday(day) ? 'rgba(229,62,62,0.02)' : 'transparent',
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bookings overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 60, right: 0, bottom: 0,
          pointerEvents: 'none', height: TOTAL_HEIGHT,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
            {days.map((day) => {
              const dayBookings = bookings.filter((b) => isSameDay(parseISO(b.scheduled_at), day))
              const positioned = resolveOverlaps(dayBookings)
              return (
                <div key={day.toISOString()} style={{ position: 'relative', pointerEvents: 'auto' }}>
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
