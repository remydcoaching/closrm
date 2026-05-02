'use client'

import { format, parseISO, addMinutes } from 'date-fns'
import { BookingWithCalendar } from '@/types'
import { Z_AGENDA } from '@/lib/agenda/z-index'

interface BookingBlockProps {
  booking: BookingWithCalendar
  onClick: (booking: BookingWithCalendar) => void
  style?: React.CSSProperties
  draggable?: boolean
}

export function BookingBlock({ booking, onClick, style, draggable = true }: BookingBlockProps) {
  const color = booking.is_personal
    ? (booking.form_data?.color as string) || '#6b7280'
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
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('bookingId', booking.id)
        e.dataTransfer.setData('duration', String(booking.duration_minutes))
        e.dataTransfer.effectAllowed = 'move'
      }}
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
        zIndex: Z_AGENDA.eventBlock,
        transition: 'opacity 0.1s',
        display: 'flex',
        flexDirection: isShort ? 'row' : 'column',
        alignItems: isShort ? 'center' : 'flex-start',
        gap: isShort ? 6 : 0,
        minWidth: 0,
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {isShort ? (
        /* Single line: "10:00 - 10:30  Antoine Roux" */
        <>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {startTime} - {endTime}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
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
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
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
