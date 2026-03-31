'use client'

import { useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MiniCalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(selectedDate))

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr })

  return (
    <div style={{ padding: '12px', userSelect: 'none' }}>
      {/* Month navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={16} />
        </button>

        <span
          style={{
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}
        >
          {monthLabel}
        </span>

        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Mois suivant"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: '4px',
        }}
      >
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              padding: '2px 0',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
        }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const isSelected = isSameDay(day, selectedDate)
          const isTodayDay = isToday(day)

          let background = 'transparent'
          let color = inMonth ? 'var(--text-primary)' : 'var(--text-label)'
          let border = 'none'
          let outline = 'none'

          if (isSelected) {
            background = 'var(--color-primary)'
            color = 'var(--text-primary)'
          } else if (isTodayDay) {
            border = '1.5px solid var(--color-primary)'
            color = inMonth ? 'var(--text-primary)' : 'var(--text-muted)'
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background,
                color,
                border,
                outline,
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }
              }}
              aria-label={format(day, 'd MMMM yyyy', { locale: fr })}
              aria-pressed={isSelected}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
