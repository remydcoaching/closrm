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

  // Short blocks (<=30min) → single line
  const isShort = booking.duration_minutes <= 30

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
        padding: isShort ? '2px 6px' : '4px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 1,
        transition: 'opacity 0.1s',
        display: 'flex',
        flexDirection: isShort ? 'row' : 'column',
        alignItems: isShort ? 'center' : 'flex-start',
        gap: isShort ? 6 : 0,
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {isShort ? (
        /* Single line: "10:00 - 10:30  Antoine Roux" */
        <>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {startTime} - {endTime}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayTitle}
          </span>
        </>
      ) : (
        /* Multi-line for longer blocks */
        <>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            width: '100%',
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
              width: '100%',
            }}>
              {calendarName}{calendarName && locationName ? ' · ' : ''}{locationName}
            </div>
          )}
        </>
      )}
    </div>
  )
}
