'use client'

/**
 * Day view — Phase 4. Réutilise les primitives EventCard / EventTooltip /
 * NowIndicator / AllDayBanner. Conceptuellement = WeekView avec 1 colonne, mais
 * le rendu reste séparé pour ne pas alourdir WeekView avec des branches cols=1.
 *
 * Particularités vs week :
 *  - Now indicator pleine largeur (fullWidth=true)
 *  - Pas de header "jour" (la date est déjà dans la toolbar) — on garde quand
 *    même un mini-header avec "Aujourd'hui" / le numéro pour cohérence visuelle
 */

import { useMemo } from 'react'
import { format, isSameDay, isToday, parseISO } from 'date-fns'
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

interface DayViewProps {
  date: Date
  events: AgendaEvent[]
  onEventClick?: (event: AgendaEvent) => void
  onSlotClick?: (dayDate: Date, hour: number) => void
}

const GUTTER_WIDTH = 56
const HEADER_HEIGHT = 40

export function DayView({ date, events, onEventClick, onSlotClick }: DayViewProps) {
  const dayEvents = useMemo(
    () => events.filter((ev) => isSameDay(parseISO(ev.start), date)),
    [events, date],
  )
  const layout = useMemo(() => computeOverlapLayout(dayEvents), [dayEvents])
  const today = isToday(date)
  const gridHeight = totalGridHeight()

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
      {/* Mini-header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${GUTTER_WIDTH}px 1fr`,
          height: HEADER_HEIGHT,
          borderBottom: '1px solid var(--agenda-grid-line-strong)',
          flexShrink: 0,
          zIndex: Z_AGENDA.stickyHeader,
        }}
      >
        <div />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
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
            {format(date, 'EEEE', { locale: fr })}
          </span>
          <span
            style={{
              fontSize: 14,
              color: today ? 'var(--color-primary)' : 'var(--text-primary)',
              fontWeight: today ? 700 : 500,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {format(date, 'd MMMM', { locale: fr })}
          </span>
        </div>
      </div>

      {/* All-day banner */}
      <AllDayBanner events={[]} columns={1} gutterWidth={GUTTER_WIDTH} />

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER_WIDTH}px 1fr`,
            height: gridHeight,
            position: 'relative',
          }}
        >
          {/* Gutter horaires */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour + 1 }).map(
              (_, i) => {
                const hour = DEFAULT_GEOMETRY.startHour + i
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * 2 * DEFAULT_GEOMETRY.slotHeight - 6,
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
              },
            )}
          </div>

          {/* Colonne unique */}
          <div
            onClick={(e) => {
              if (!onSlotClick) return
              const target = e.target as HTMLElement
              if (target.closest('[data-agenda-event]')) return
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const hour = snapToHalf(pixelToHour(y))
              onSlotClick(date, hour)
            }}
            style={{
              position: 'relative',
              borderLeft: '1px solid var(--agenda-grid-line)',
              background: today ? 'var(--agenda-today-tint)' : 'transparent',
              cursor: onSlotClick ? 'cell' : 'default',
            }}
          >
            {/* Lignes horaires */}
            {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour + 1 }).map(
              (_, hIdx) => (
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
              ),
            )}
            {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour }).map(
              (_, hIdx) => (
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
              ),
            )}

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
                      left: `calc(${ovr.column * widthPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                    }}
                  />
                </EventTooltip>
              )
            })}

            {/* Now indicator pleine largeur */}
            {today && <NowIndicator fullWidth gutterWidth={0} />}
          </div>
        </div>
      </div>
    </div>
  )
}
