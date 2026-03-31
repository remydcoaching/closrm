'use client'

import { format, parseISO, addMinutes } from 'date-fns'
import { BookingWithCalendar } from '@/types'

interface BookingBlockProps {
  booking: BookingWithCalendar
  onClick: (booking: BookingWithCalendar) => void
  style?: React.CSSProperties
}

export function BookingBlock({ booking, onClick, style }: BookingBlockProps) {
  const color = booking.is_personal
    ? '#6b7280'
    : booking.booking_calendar?.color || '#3b82f6'

  const leadName = booking.lead
    ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
    : null

  const displayTitle = booking.is_personal
    ? booking.title
    : leadName || booking.title

  const startTime = format(parseISO(booking.scheduled_at), 'HH:mm')
  const endTime = format(addMinutes(parseISO(booking.scheduled_at), booking.duration_minutes), 'HH:mm')

  const calendarName = booking.booking_calendar?.name || null
  const locationName = booking.location?.name || null

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(booking) }}
      style={{
        position: 'absolute',
        left: 2,
        right: 2,
        pointerEvents: 'auto',
        background: `${color}26`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: '4px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 1,
        transition: 'opacity 0.1s',
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      <div style={{
        fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {displayTitle}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>
        {startTime} - {endTime}
      </div>
      {(calendarName || locationName) && (
        <div style={{
          fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {calendarName}{calendarName && locationName ? ' · ' : ''}{locationName}
        </div>
      )}
    </div>
  )
}
