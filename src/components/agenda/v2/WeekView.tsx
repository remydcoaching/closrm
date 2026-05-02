'use client'

/**
 * Week view statique (Phase 3a) — read-only.
 *
 * Layout :
 *  ┌───────┬─────────────────────────────────────┐
 *  │       │ Lun 28 │ Mar 29 │ ... │ Dim 4       │  ← header sticky 40px
 *  ├───────┼─────────────────────────────────────┤
 *  │ All-d │  ----  │  ----  │     │             │  ← all-day 24px
 *  ├───────┼────────┼────────┼─────┼─────────────┤
 *  │ 07:00 │        │        │     │             │
 *  │ 07:30 │        │        │     │             │
 *  │ ...   │  cards │        │     │             │  ← scroll body
 *  │ 22:00 │        │        │     │             │
 *  └───────┴─────────────────────────────────────┘
 *
 * Pas d'interactions cette phase : click event → console.log, click slot vide
 * → rien. Les événements sont positionnés en absolute via `eventToPosition` +
 * `computeOverlapLayout`.
 */

import { useMemo } from 'react'
import {
  addDays,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
  format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { EventCard } from './EventCard'
import { EventTooltip } from './EventTooltip'
import { NowIndicator } from './NowIndicator'
import { AllDayBanner } from './AllDayBanner'
import {
  DEFAULT_GEOMETRY,
  computeOverlapLayout,
  eventToPosition,
  pixelToHour,
  snapToHalf,
  totalGridHeight,
} from '@/lib/agenda/positioning'
import type { AgendaEvent } from '@/types/agenda'
import { Z_AGENDA } from '@/lib/agenda/z-index'

interface WeekViewProps {
  /** N'importe quelle date dans la semaine. On calcule weekStart côté composant. */
  date: Date
  events: AgendaEvent[]
  onEventClick?: (event: AgendaEvent) => void
  /** Callback quand un slot vide est cliqué. `dayDate` = date du jour cliqué
   *  (00:00:00 local), `hour` = heure flottante snappée à la demi-heure. */
  onSlotClick?: (dayDate: Date, hour: number) => void
}

const GUTTER_WIDTH = 56
const HEADER_HEIGHT = 40

export function WeekView({ date, events, onEventClick, onSlotClick }: WeekViewProps) {
  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  /* Group events by day index (0-6) */
  const eventsByDay = useMemo(() => {
    const map: AgendaEvent[][] = Array.from({ length: 7 }, () => [])
    for (const ev of events) {
      const d = parseISO(ev.start)
      for (let i = 0; i < 7; i++) {
        if (isSameDay(d, days[i])) {
          map[i].push(ev)
          break
        }
      }
    }
    return map
  }, [events, days])

  /* Overlap layouts per day */
  const layoutsByDay = useMemo(
    () => eventsByDay.map((dayEvents) => computeOverlapLayout(dayEvents)),
    [eventsByDay],
  )

  const gridHeight = totalGridHeight()
  const slotsCount = (DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour) * 2

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header sticky : jours de la semaine */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, 1fr)`,
          height: HEADER_HEIGHT,
          borderBottom: '1px solid var(--agenda-grid-line-strong)',
          flexShrink: 0,
          zIndex: Z_AGENDA.stickyHeader,
        }}
      >
        <div /> {/* gutter spacer */}
        {days.map((d) => {
          const today = isToday(d)
          return (
            <div
              key={d.toISOString()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                borderLeft: '1px solid var(--agenda-grid-line)',
                background: today ? 'var(--agenda-today-tint)' : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontWeight: 600,
                }}
              >
                {format(d, 'EEE', { locale: fr })}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: today ? 'var(--color-primary)' : 'var(--text-primary)',
                  fontWeight: today ? 700 : 500,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {format(d, 'd', { locale: fr })}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-day banner */}
      <AllDayBanner events={[]} columns={7} gutterWidth={GUTTER_WIDTH} />

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, 1fr)`,
            height: gridHeight,
            position: 'relative',
          }}
        >
          {/* Gutter horaires */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: slotsCount + 1 }).map((_, i) => {
              if (i % 2 !== 0) return null // afficher seulement aux heures pleines
              const hour = DEFAULT_GEOMETRY.startHour + i / 2
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: i * DEFAULT_GEOMETRY.slotHeight - 6,
                    right: 8,
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents: 'none',
                  }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              )
            })}
          </div>

          {/* Colonnes jours */}
          {days.map((d, dayIdx) => {
            const today = isToday(d)
            const dayEvents = eventsByDay[dayIdx]
            const layout = layoutsByDay[dayIdx]

            return (
              <div
                key={d.toISOString()}
                onClick={(e) => {
                  if (!onSlotClick) return
                  // Ignorer les clicks qui bubble depuis EventCard
                  const target = e.target as HTMLElement
                  if (target.closest('[data-agenda-event]')) return
                  const colRect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - colRect.top
                  const hour = snapToHalf(pixelToHour(y))
                  onSlotClick(d, hour)
                }}
                style={{
                  position: 'relative',
                  borderLeft: '1px solid var(--agenda-grid-line)',
                  background: today ? 'var(--agenda-today-tint)' : 'transparent',
                  cursor: onSlotClick ? 'cell' : 'default',
                }}
              >
                {/* Lignes horaires (toutes les heures pleines) */}
                {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour + 1 }).map((_, hIdx) => (
                  <div
                    key={hIdx}
                    style={{
                      position: 'absolute',
                      top: hIdx * 2 * DEFAULT_GEOMETRY.slotHeight,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--agenda-grid-line-strong)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
                {/* Demi-heures */}
                {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour }).map((_, hIdx) => (
                  <div
                    key={`half-${hIdx}`}
                    style={{
                      position: 'absolute',
                      top: (hIdx * 2 + 1) * DEFAULT_GEOMETRY.slotHeight,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--agenda-grid-line)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const pos = eventToPosition(ev.start, ev.durationMinutes)
                  if (!pos) return null
                  const ovr = layout.get(ev.id) ?? { column: 0, groupSize: 1 }
                  const widthPct = 100 / ovr.groupSize
                  return (
                    <EventTooltip key={ev.id} event={ev}>
                      <EventCard
                        event={ev}
                        onClick={onEventClick}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `calc(${ovr.column * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      />
                    </EventTooltip>
                  )
                })}
              </div>
            )
          })}

          {/* Now indicator : dot dans la gutter (toute la grille), ligne dans la colonne du jour courant */}
          <NowIndicatorOverlay todayIdx={days.findIndex((d) => isToday(d))} gutterWidth={GUTTER_WIDTH} />
        </div>
      </div>
    </div>
  )
}

/**
 * Overlay positionné sur la grille parente — le dot tombe dans la gutter
 * commune à toute la semaine, la ligne ne traverse que la colonne du jour
 * courant. Si aujourd'hui n'est pas dans la semaine visible, on rend juste
 * le dot sans ligne.
 */
function NowIndicatorOverlay({ todayIdx, gutterWidth }: { todayIdx: number; gutterWidth: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Si aujourd'hui n'est pas dans la semaine, on cache la ligne en
          rendant le composant en mode "jour absent" (NowIndicator gère le
          null si hors plage horaire ; pas hors plage de jour). On utilise
          une astuce : si todayIdx=-1, on n'affiche pas la ligne. */}
      {todayIdx >= 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `calc(${gutterWidth}px + ${todayIdx} * (100% - ${gutterWidth}px) / 7)`,
            width: `calc((100% - ${gutterWidth}px) / 7)`,
            height: '100%',
          }}
        >
          <NowIndicator fullWidth gutterWidth={0} />
        </div>
      ) : null}
    </div>
  )
}
