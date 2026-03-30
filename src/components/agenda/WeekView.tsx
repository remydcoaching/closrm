import { startOfWeek, addDays, isSameDay, isToday, getHours, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BookingWithCalendar } from '@/types'
import { BookingBlock } from './BookingBlock'

interface WeekViewProps {
  date: Date
  bookings: BookingWithCalendar[]
  onBookingClick: (booking: BookingWithCalendar) => void
  onSlotClick: (date: Date, hour: number) => void
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8h–21h

export function WeekView({ date, bookings, onBookingClick, onSlotClick }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px repeat(7, 1fr)',
          borderBottom: '1px solid #262626',
          position: 'sticky',
          top: 0,
          background: '#141414',
          zIndex: 10,
        }}
      >
        {/* Empty corner */}
        <div style={{ borderRight: '1px solid #262626' }} />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              style={{
                padding: '8px 4px',
                textAlign: 'center',
                borderRight: '1px solid #262626',
                color: today ? '#E53E3E' : '#A0A0A0',
                fontWeight: today ? 700 : 400,
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase' }}>
                {format(day, 'EEE', { locale: fr })}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: today ? '#ffffff' : '#ffffff',
                  background: today ? '#E53E3E' : 'transparent',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  lineHeight: '32px',
                  margin: '2px auto 0',
                }}
              >
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div style={{ flex: 1 }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px repeat(7, 1fr)',
              borderBottom: '1px solid #262626',
            }}
          >
            {/* Hour label */}
            <div
              style={{
                fontSize: 11,
                color: '#A0A0A0',
                padding: '4px 8px',
                textAlign: 'right',
                borderRight: '1px solid #262626',
                userSelect: 'none',
              }}
            >
              {hour}h
            </div>

            {/* Day cells */}
            {days.map((day) => {
              const today = isToday(day)
              const cellBookings = bookings.filter((b) => {
                const start = parseISO(b.scheduled_at)
                return isSameDay(start, day) && getHours(start) === hour
              })

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    if (cellBookings.length === 0) {
                      onSlotClick(day, hour)
                    }
                  }}
                  style={{
                    minHeight: 40,
                    borderRight: '1px solid #262626',
                    padding: '2px 3px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    background: today ? 'rgba(229,62,62,0.03)' : 'transparent',
                    cursor: cellBookings.length === 0 ? 'pointer' : 'default',
                  }}
                >
                  {cellBookings.map((booking) => (
                    <BookingBlock
                      key={booking.id}
                      booking={booking}
                      onClick={onBookingClick}
                      compact
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
