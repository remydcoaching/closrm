'use client'

/**
 * Mini calendrier dans la sidebar gauche. Grid 7×6 cellules 28×28.
 * Click un jour → propage `selectedDate` au parent.
 *
 * Le mois affiché est indépendant de `selectedDate` (l'utilisateur peut
 * naviguer en avant/arrière sans changer la sélection courante).
 */

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MiniCalendarProps {
  /** Date sélectionnée dans l'agenda principal — surlignée. */
  selectedDate: Date
  /** Callback : utilisateur a cliqué un jour. */
  onSelectDate: (date: Date) => void
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState<Date>(() => selectedDate)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(displayMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(displayMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [displayMonth])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header : mois + flèches */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'capitalize',
          }}
        >
          {format(displayMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            type="button"
            onClick={() => setDisplayMonth((d) => subMonths(d, 1))}
            aria-label="Mois précédent"
            style={navStyle}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDisplayMonth((d) => addMonths(d, 1))}
            aria-label="Mois suivant"
            style={navStyle}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}
      >
        {DAY_LABELS.map((l, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 9,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, displayMonth)
          const today = isToday(day)
          const selected = isSameDay(day, selectedDate)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              style={{
                aspectRatio: '1 / 1',
                width: '100%',
                border: 'none',
                borderRadius: 4,
                background: selected
                  ? 'var(--color-primary)'
                  : today
                    ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                    : 'transparent',
                color: selected
                  ? '#fff'
                  : today
                    ? 'var(--color-primary)'
                    : inMonth
                      ? 'var(--text-primary)'
                      : 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: selected || today ? 700 : 500,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                opacity: inMonth || selected ? 1 : 0.4,
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!selected && !today) {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!selected && !today) {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              {format(day, 'd', { locale: fr })}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const navStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  padding: 4,
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
}
