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

import { useEffect, useMemo, useRef, useState } from 'react'
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
  onSlotClick?: (dayDate: Date, hour: number, durationMinutes?: number) => void
}

interface DragState {
  startHour: number
  currentHour: number
  isDragging: boolean
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

  // Auto-scroll au montage (heure courante - 1, fallback 7h)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const now = new Date()
    const targetHour = Math.max(7, now.getHours() - 1)
    body.scrollTop = (targetHour - DEFAULT_GEOMETRY.startHour) * 2 * DEFAULT_GEOMETRY.slotHeight
  }, [])

  // Drag-to-select
  const [drag, setDrag] = useState<DragState | null>(null)
  const colRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!drag) return
    const col = colRef.current
    if (!col) return
    const onMove = (e: MouseEvent) => {
      const rect = col.getBoundingClientRect()
      const y = e.clientY - rect.top
      const newHour = snapToHalf(pixelToHour(y))
      setDrag((prev) => {
        if (!prev) return prev
        if (prev.currentHour === newHour) return prev
        return {
          ...prev,
          currentHour: newHour,
          isDragging: prev.isDragging || newHour !== prev.startHour,
        }
      })
    }
    const onUp = () => {
      setDrag((prev) => {
        if (!prev) return null
        if (prev.isDragging) {
          const start = Math.min(prev.startHour, prev.currentHour)
          const end = Math.max(prev.startHour, prev.currentHour) + 0.5
          const minutes = Math.max(30, Math.round((end - start) * 60))
          onSlotClick?.(date, start, minutes)
        } else {
          onSlotClick?.(date, prev.startHour)
        }
        return null
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [drag, date, onSlotClick])

  const dragStart = drag ? Math.min(drag.startHour, drag.currentHour) : null
  const dragEnd = drag ? Math.max(drag.startHour, drag.currentHour) + 0.5 : null

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
            gap: 10,
            background: 'transparent',
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: today ? 'var(--color-primary)' : 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              fontWeight: 600,
            }}
          >
            {format(date, 'EEEE', { locale: fr })}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: today ? 600 : 500,
              color: today ? '#000' : 'var(--text-primary)',
              background: today ? 'var(--color-primary)' : 'transparent',
              padding: today ? '4px 10px' : '0',
              borderRadius: 999,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {format(date, 'd MMMM', { locale: fr })}
          </span>
        </div>
      </div>

      {/* All-day banner */}
      <AllDayBanner events={[]} columns={1} gutterWidth={GUTTER_WIDTH} />

      {/* Scrollable body */}
      <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER_WIDTH}px 1fr`,
            height: gridHeight,
            position: 'relative',
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              var(--agenda-grid-line-strong) 0,
              var(--agenda-grid-line-strong) 1px,
              transparent 1px,
              transparent ${DEFAULT_GEOMETRY.slotHeight * 2}px
            )`,
          }}
        >
          {/* Gutter horaires — labels au-dessus de la ligne (Google Cal-style) */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: DEFAULT_GEOMETRY.endHour - DEFAULT_GEOMETRY.startHour + 1 }).map(
              (_, i) => {
                if (i === 0) return null
                if (DEFAULT_GEOMETRY.startHour + i >= 24) return null // pas de "24:00"
                const hour = DEFAULT_GEOMETRY.startHour + i
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * 2 * DEFAULT_GEOMETRY.slotHeight - 14,
                      right: 8,
                      fontSize: 10.5,
                      color: 'var(--text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 500,
                      lineHeight: 1,
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
            ref={colRef}
            onMouseDown={(e) => {
              if (!onSlotClick) return
              if (e.button !== 0) return
              const target = e.target as HTMLElement
              if (target.closest('[data-agenda-event]')) return
              e.preventDefault()
              const rect = e.currentTarget.getBoundingClientRect()
              const y = e.clientY - rect.top
              const hour = snapToHalf(pixelToHour(y))
              setDrag({ startHour: hour, currentHour: hour, isDragging: false })
            }}
            style={{
              position: 'relative',
              borderLeft: '1px solid var(--agenda-grid-line)',
              background: today ? 'var(--agenda-today-tint)' : 'transparent',
              cursor: onSlotClick ? 'cell' : 'default',
              userSelect: drag ? 'none' : 'auto',
            }}
          >
            {/* Lignes horaires : voir gradient sur le parent grid. */}

            {/* Drag preview */}
            {dragStart !== null && dragEnd !== null && drag?.isDragging && (
              <DragSelectionPreview start={dragStart} end={dragEnd} />
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

function DragSelectionPreview({ start, end }: { start: number; end: number }) {
  const top = (start - DEFAULT_GEOMETRY.startHour) * 2 * DEFAULT_GEOMETRY.slotHeight
  const height = (end - start) * 2 * DEFAULT_GEOMETRY.slotHeight
  const minutes = Math.round((end - start) * 60)
  const durationLabel = minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? String(minutes % 60).padStart(2, '0') : ''}`
    : `${minutes} min`
  function fmt(h: number): string {
    const hh = Math.floor(h)
    const mm = Math.round((h - hh) * 60)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  return (
    <div
      style={{
        position: 'absolute',
        top, height,
        left: 4, right: 4,
        background: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 60%, transparent)',
        borderRadius: 4,
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.3,
        overflow: 'hidden',
      }}
    >
      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{fmt(start)} → {fmt(end)}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{durationLabel}</span>
    </div>
  )
}
