'use client'

/**
 * Month view — Phase 4. Grid 7×6 cells (5-6 semaines selon le mois).
 * Chaque cellule affiche jusqu'à 3 mini event chips, puis un bouton
 * "+N autres" qui ouvre la day view du jour cliqué.
 *
 * Style :
 *  - Today : background --agenda-today-tint, numéro en couleur primary bold
 *  - Days hors mois courant : opacity 0.35
 *  - Mini chip : pastille couleur 4×4 + heure tabular + titre ellipsis
 *  - Click cellule (zone vide) → bascule en day view via onDayClick
 *  - Click chip → onEventClick (ouvre side panel parent)
 */

import { useMemo } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { AgendaEvent } from '@/types/agenda'

interface MonthViewProps {
  date: Date
  events: AgendaEvent[]
  onEventClick?: (event: AgendaEvent) => void
  onDayClick?: (date: Date) => void
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_CHIPS = 3

export function MonthView({ date, events, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  )

  function eventsForDay(day: Date): AgendaEvent[] {
    return events.filter((ev) => isSameDay(parseISO(ev.start), day))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Day labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--agenda-grid-line-strong)',
          flexShrink: 0,
        }}
      >
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              padding: '10px 0',
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          flex: 1,
          gridAutoRows: 'minmax(96px, 1fr)',
          overflow: 'auto',
        }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, date)
          const today = isToday(day)
          const dayEvents = eventsForDay(day)
          const visible = dayEvents.slice(0, MAX_CHIPS)
          const overflow = dayEvents.length - MAX_CHIPS

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.closest('[data-agenda-event]')) return
                if (target.closest('[data-agenda-overflow]')) return
                onDayClick?.(day)
              }}
              style={{
                border: '1px solid var(--agenda-grid-line)',
                background: today ? 'var(--agenda-today-tint)' : 'transparent',
                opacity: inMonth ? 1 : 0.35,
                padding: '6px 8px',
                cursor: onDayClick ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                minWidth: 0,
              }}
            >
              {/* Day number */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: today ? 700 : 500,
                    color: today ? 'var(--color-primary)' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {format(day, 'd', { locale: fr })}
                </span>
              </div>

              {/* Mini chips */}
              {visible.map((ev) => (
                <button
                  type="button"
                  key={ev.id}
                  data-agenda-event={ev.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick?.(ev)
                  }}
                  title={`${ev.title} · ${format(parseISO(ev.start), 'HH:mm')}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 4px',
                    borderRadius: 3,
                    border: 'none',
                    background: `color-mix(in srgb, ${ev.color} calc(var(--agenda-event-fill-opacity) * 100%), transparent)`,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 1,
                      background: ev.color,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {format(parseISO(ev.start), 'HH:mm')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {ev.title}
                  </span>
                </button>
              ))}

              {/* Overflow indicator */}
              {overflow > 0 && (
                <button
                  type="button"
                  data-agenda-overflow
                  onClick={(e) => {
                    e.stopPropagation()
                    onDayClick?.(day)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '1px 4px',
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: 2,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                >
                  +{overflow} autre{overflow > 1 ? 's' : ''}
                </button>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
