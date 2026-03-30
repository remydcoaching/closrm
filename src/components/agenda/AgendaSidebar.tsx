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
        background: '#141414',
        borderRight: '1px solid #262626',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Mini calendar */}
      <MiniCalendar selectedDate={selectedDate} onDateSelect={onDateSelect} />

      {/* Divider */}
      <div style={{ height: 1, background: '#262626', margin: '0 12px' }} />

      {/* Calendars section */}
      <div style={{ padding: '16px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#A0A0A0',
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
                  color: visible ? '#FFFFFF' : '#666',
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
              color: showPersonal ? '#FFFFFF' : '#666',
            }}
          >
            Événements personnels
          </span>
        </button>
      </div>
    </div>
  )
}
