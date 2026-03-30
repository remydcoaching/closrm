'use client'

import MiniCalendar from './MiniCalendar'
import { BookingCalendar } from '@/types'

interface AgendaSidebarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  calendars: BookingCalendar[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (id: string) => void
  showPersonal: boolean
  onTogglePersonal: () => void
}

export function AgendaSidebar({
  selectedDate,
  onDateSelect,
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
  showPersonal,
  onTogglePersonal,
}: AgendaSidebarProps) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Mini calendar */}
      <MiniCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-secondary)', margin: '0 12px' }} />

      {/* Calendars section */}
      <div style={{ padding: '16px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          Calendriers
        </div>

        {calendars.map((cal) => {
          const visible = visibleCalendarIds.has(cal.id)
          return (
            <button
              key={cal.id}
              onClick={() => onToggleCalendar(cal.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px 0',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: visible ? cal.color : 'transparent',
                  border: `2px solid ${cal.color}`,
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: visible ? 'var(--text-primary)' : 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cal.name}
              </span>
            </button>
          )
        })}

        {/* Personal events */}
        <button
          onClick={onTogglePersonal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px 0',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: showPersonal ? '#6b7280' : 'transparent',
              border: '2px solid #6b7280',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          />
          <span
            style={{
              fontSize: 13,
              color: showPersonal ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Événements personnels
          </span>
        </button>
      </div>
    </div>
  )
}
