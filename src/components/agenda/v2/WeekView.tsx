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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Callback quand un slot vide est cliqué OU qu'une plage est sélectionnée
   *  par drag. `hour` = heure de début snappée à la demi-heure.
   *  `durationMinutes` = durée si l'utilisateur a draggé une plage ; absent
   *  pour un click simple (le parent applique la durée par défaut). */
  onSlotClick?: (dayDate: Date, hour: number, durationMinutes?: number) => void
  /** Drag-and-drop : appelé quand un event a été déplacé. `newScheduledAt`
   *  est l'ISO string de la nouvelle date+heure de début. Ne déclenche que
   *  pour les bookings (pas les calls). */
  onEventMove?: (event: AgendaEvent, newScheduledAt: string) => void
  /** ID de l'event highlighted (sélectionné au 1er clic, panel pas encore
   *  ouvert). Affichage : ring renforcé sur la card. */
  highlightedEventId?: string | null
  /** Callback déclenché à chaque mouvement de souris dans la grille.
   *  Le parent peut stocker la position pour un paste ulterieur. `null` = hors grille. */
  onHoverChange?: (date: Date | null, hour: number | null) => void
}

interface DragState {
  dayIdx: number
  startHour: number
  currentHour: number
  isDragging: boolean
}

interface DragMoveState {
  event: AgendaEvent
  /** Heure de début ORIGINALE de l'event (pour reset si pas de drag). */
  originalStartHour: number
  originalDayIdx: number
  /** Décalage minutes entre le pointeur et le début de l'event au mousedown.
   *  On garde le pointeur "ancré" au même point dans la card pendant le drag. */
  pointerOffsetMinutes: number
  /** Position courante (target) snappée à la demi-heure. */
  currentDayIdx: number
  currentHour: number
  isDragging: boolean
  startClientX: number
  startClientY: number
}

const GUTTER_WIDTH = 56
const HEADER_HEIGHT = 40

export function WeekView({
  date,
  events,
  onEventClick,
  onSlotClick,
  onEventMove,
  highlightedEventId,
  onHoverChange,
}: WeekViewProps) {
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

  // ── Hover tracking pour copy/paste : on track la cellule survolée et on
  //    notifie le parent via onHoverChange. Pas de re-render local : le
  //    parent peut stocker dans une ref pour ne pas thrash.
  useEffect(() => {
    if (!onHoverChange) return
    let lastDay = -1
    let lastHour = -1
    function onMove(e: MouseEvent) {
      let foundIdx = -1
      let rect: DOMRect | null = null
      for (let i = 0; i < 7; i++) {
        const col = colRefs.current[i]
        if (!col) continue
        const r = col.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) {
          foundIdx = i
          rect = r
          break
        }
      }
      if (foundIdx < 0 || !rect) {
        if (lastDay !== -2) {
          lastDay = -2
          onHoverChange?.(null, null)
        }
        return
      }
      const y = e.clientY - rect.top
      const hour = pixelToHour(y)
      if (foundIdx === lastDay && Math.abs(hour - lastHour) < 0.05) return
      lastDay = foundIdx
      lastHour = hour
      onHoverChange?.(days[foundIdx], hour)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [days, onHoverChange])

  // ── Auto-scroll au montage : positionne la grille sur l'heure courante
  //    (ou 7h par défaut si on est en pleine nuit). Évite que l'utilisateur
  //    arrive par défaut à minuit.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const now = new Date()
    const targetHour = Math.max(7, now.getHours() - 1)
    body.scrollTop = (targetHour - DEFAULT_GEOMETRY.startHour) * 2 * DEFAULT_GEOMETRY.slotHeight
  }, [])

  // ── Drag-to-select : mousedown sur une colonne jour ouvre une plage que
  //    l'utilisateur peut étirer. Au mouseup, on appelle onSlotClick avec la
  //    durée correspondante. Si la souris n'a pas bougé (ou est restée dans la
  //    même demi-heure), on retombe sur un click simple sans durée.
  const [drag, setDrag] = useState<DragState | null>(null)
  const colRefs = useRef<(HTMLDivElement | null)[]>([])

  // ── Drag-to-move : mousedown sur une EventCard initie un drag potentiel.
  //    Au-delà d'un seuil de 5px, on bascule en mode déplacement. Click sans
  //    drag = onEventClick. Drop sur une autre cellule = onEventMove(event, isoNewStart).
  const [dragMove, setDragMove] = useState<DragMoveState | null>(null)
  const justDragMovedRef = useRef(false)

  const handleEventCardClick = useCallback((ev: AgendaEvent) => {
    // Si on vient de finir un drag-move, on suppress le click qui suit
    if (justDragMovedRef.current) {
      justDragMovedRef.current = false
      return
    }
    onEventClick?.(ev)
  }, [onEventClick])

  // Document-level handlers pour le drag-move (mousemove / mouseup)
  useEffect(() => {
    if (!dragMove) return

    function findDayIdx(clientX: number): number {
      for (let i = 0; i < 7; i++) {
        const col = colRefs.current[i]
        if (!col) continue
        const r = col.getBoundingClientRect()
        if (clientX >= r.left && clientX < r.right) return i
      }
      return -1
    }

    function onMove(e: MouseEvent) {
      setDragMove((prev) => {
        if (!prev) return prev
        const dx = e.clientX - prev.startClientX
        const dy = e.clientY - prev.startClientY
        const moved = Math.hypot(dx, dy) >= 5
        const isDragging = prev.isDragging || moved
        let currentDayIdx = prev.currentDayIdx
        let currentHour = prev.currentHour
        const targetDayIdx = findDayIdx(e.clientX)
        const refIdx = targetDayIdx >= 0 ? targetDayIdx : prev.currentDayIdx
        const col = colRefs.current[refIdx]
        if (col) {
          const rect = col.getBoundingClientRect()
          const y = e.clientY - rect.top
          const cursorHour = pixelToHour(y)
          // Conserve l'offset pointer→event-start
          const newStart = snapToHalf(cursorHour - prev.pointerOffsetMinutes / 60)
          currentHour = Math.max(0, Math.min(23.5, newStart))
          if (targetDayIdx >= 0) currentDayIdx = targetDayIdx
        }
        if (
          prev.isDragging === isDragging
          && prev.currentDayIdx === currentDayIdx
          && prev.currentHour === currentHour
        ) {
          return prev
        }
        return { ...prev, isDragging, currentDayIdx, currentHour }
      })
    }

    function onUp() {
      setDragMove((prev) => {
        if (!prev) return null
        if (prev.isDragging) {
          // Ignore les "no-op" : même jour + même heure que l'origine
          const sameDay = prev.currentDayIdx === prev.originalDayIdx
          const sameHour = Math.abs(prev.currentHour - prev.originalStartHour) < 0.001
          if (!(sameDay && sameHour)) {
            const targetDay = days[prev.currentDayIdx]
            const newDate = new Date(targetDay)
            const h = Math.floor(prev.currentHour)
            const m = Math.round((prev.currentHour - h) * 60)
            newDate.setHours(h, m, 0, 0)
            justDragMovedRef.current = true
            onEventMove?.(prev.event, newDate.toISOString())
          }
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
  }, [dragMove, days, onEventMove])

  useEffect(() => {
    if (!drag) return
    const col = colRefs.current[drag.dayIdx]
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
          onSlotClick?.(days[prev.dayIdx], start, minutes)
        } else {
          onSlotClick?.(days[prev.dayIdx], prev.startHour)
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
  }, [drag, days, onSlotClick])

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
                gap: 2,
                borderLeft: '1px solid var(--agenda-grid-line)',
                background: 'transparent',
                paddingTop: 4,
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
                {format(d, 'EEE', { locale: fr })}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: today ? 600 : 500,
                  color: today ? '#000' : 'var(--text-primary)',
                  background: today ? 'var(--color-primary)' : 'transparent',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
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
      <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, 1fr)`,
            height: gridHeight,
            position: 'relative',
            // Lignes horaires en arrière-plan : un gradient sur la grille,
            // sous les cards (qui sont opaques et masquent la ligne là où elles
            // sont posées). C'est la convention Google Calendar.
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              var(--agenda-grid-line-strong) 0,
              var(--agenda-grid-line-strong) 1px,
              transparent 1px,
              transparent ${DEFAULT_GEOMETRY.slotHeight * 2}px
            )`,
          }}
        >
          {/* Gutter horaires — labels positionnés JUSTE AU-DESSUS de la ligne
              pleine heure (style Google Cal) plutôt que centrés sur la ligne,
              pour éviter l'effet "ligne barrée à travers le texte". */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: slotsCount + 1 }).map((_, i) => {
              if (i % 2 !== 0) return null // heures pleines uniquement
              if (i === 0) return null     // pas de label au tout premier pixel (clipping)
              if (i === slotsCount) return null // pas de "24:00" au bout
              const hour = DEFAULT_GEOMETRY.startHour + i / 2
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: i * DEFAULT_GEOMETRY.slotHeight - 14,
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
            })}
          </div>

          {/* Colonnes jours */}
          {days.map((d, dayIdx) => {
            const today = isToday(d)
            const dayEvents = eventsByDay[dayIdx]
            const layout = layoutsByDay[dayIdx]

            const isDragCol = drag?.dayIdx === dayIdx
            const dragStart = isDragCol && drag ? Math.min(drag.startHour, drag.currentHour) : null
            const dragEnd = isDragCol && drag ? Math.max(drag.startHour, drag.currentHour) + 0.5 : null

            const isGhostCol = dragMove?.isDragging && dragMove.currentDayIdx === dayIdx

            return (
              <div
                key={d.toISOString()}
                ref={(el) => { colRefs.current[dayIdx] = el }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  const target = e.target as HTMLElement

                  // Drag-to-move : mousedown sur une EventCard ?
                  const eventEl = target.closest('[data-agenda-event]')
                  if (eventEl && onEventMove) {
                    const eventId = eventEl.getAttribute('data-agenda-event')
                    const ev = dayEvents.find((x) => x.id === eventId)
                    if (ev && ev.kind === 'booking') {
                      e.preventDefault()
                      const colRect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - colRect.top
                      const cursorHour = pixelToHour(y)
                      const evStart = parseISO(ev.start)
                      const evStartHour = evStart.getHours() + evStart.getMinutes() / 60
                      const pointerOffsetMinutes = (cursorHour - evStartHour) * 60
                      setDragMove({
                        event: ev,
                        originalStartHour: evStartHour,
                        originalDayIdx: dayIdx,
                        pointerOffsetMinutes,
                        currentDayIdx: dayIdx,
                        currentHour: evStartHour,
                        isDragging: false,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                      })
                      return
                    }
                  }
                  if (eventEl) return // call ou pas movable → laisse le click natif

                  // Sinon : drag-to-select pour créer un nouveau RDV
                  if (!onSlotClick) return
                  e.preventDefault()
                  const colRect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - colRect.top
                  const hour = snapToHalf(pixelToHour(y))
                  setDrag({ dayIdx, startHour: hour, currentHour: hour, isDragging: false })
                }}
                style={{
                  position: 'relative',
                  borderLeft: '1px solid var(--agenda-grid-line)',
                  background: today ? 'var(--agenda-today-tint)' : 'transparent',
                  cursor: onSlotClick ? 'cell' : 'default',
                  userSelect: drag || dragMove ? 'none' : 'auto',
                }}
              >
                {/* Lignes horaires : voir gradient sur le parent grid (uniforme
                    sur toute la largeur, sans rendu par colonne). */}

                {/* Drag preview (création) */}
                {dragStart !== null && dragEnd !== null && drag?.isDragging && (
                  <DragSelectionPreview start={dragStart} end={dragEnd} />
                )}

                {/* Drag-move ghost (déplacement d'un event) */}
                {isGhostCol && dragMove && (
                  <DragMoveGhost
                    event={dragMove.event}
                    startHour={dragMove.currentHour}
                  />
                )}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const pos = eventToPosition(ev.start, ev.durationMinutes)
                  if (!pos) return null
                  const ovr = layout.get(ev.id) ?? { column: 0, groupSize: 1 }
                  const widthPct = 100 / ovr.groupSize
                  const isBeingDragged = dragMove?.isDragging && dragMove.event.id === ev.id
                  const isHighlighted = highlightedEventId === ev.id
                  return (
                    <EventTooltip key={ev.id} event={ev}>
                      <EventCard
                        event={ev}
                        onClick={handleEventCardClick}
                        isHighlighted={isHighlighted}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `calc(${ovr.column * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          opacity: isBeingDragged ? 0.3 : 1,
                          pointerEvents: isBeingDragged ? 'none' : 'auto',
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

/**
 * Ghost rendu pendant le déplacement d'un event existant. Utilise les mêmes
 * tokens visuels que EventCard mais avec une ombre portée pour signaler le
 * "vol" et un pointer-events none pour ne pas bloquer le drag.
 */
function DragMoveGhost({
  event,
  startHour,
}: {
  event: AgendaEvent
  startHour: number
}) {
  const top = (startHour - DEFAULT_GEOMETRY.startHour) * 2 * DEFAULT_GEOMETRY.slotHeight
  const height = Math.max(8, (event.durationMinutes / 30) * DEFAULT_GEOMETRY.slotHeight - 2)
  const fillBg = `color-mix(in srgb, ${event.color} 32%, var(--bg-elevated))`
  const outlineColor = `color-mix(in srgb, ${event.color} 55%, transparent)`
  const startMin = (startHour - Math.floor(startHour)) * 60
  const startLabel = `${String(Math.floor(startHour)).padStart(2, '0')}:${String(Math.round(startMin)).padStart(2, '0')}`
  return (
    <div
      style={{
        position: 'absolute',
        top, height,
        left: 2, right: 2,
        background: fillBg,
        borderRadius: 6,
        boxShadow: `inset 3px 0 0 ${event.color}, inset 0 0 0 1px ${outlineColor}, 0 8px 24px rgba(0,0,0,0.45)`,
        pointerEvents: 'none',
        zIndex: 5,
        padding: '4px 8px 4px 10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <span style={{
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        letterSpacing: -0.15,
      }}>
        {event.title}
      </span>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: `color-mix(in srgb, ${event.color} 30%, var(--text-secondary) 70%)`,
        marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {startLabel}
      </span>
    </div>
  )
}

/**
 * Aperçu visuel d'une plage en cours de drag-select : bloc translucide aux
 * couleurs du primary avec heures + durée affichées. `start`/`end` en heures
 * flottantes (ex 10.5 = 10:30).
 */
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
        top,
        height,
        left: 2,
        right: 2,
        background: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 60%, transparent)',
        borderRadius: 4,
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: '4px 6px',
        color: 'var(--text-primary)',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.3,
        overflow: 'hidden',
      }}
    >
      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
        {fmt(start)} → {fmt(end)}
      </span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
        {durationLabel}
      </span>
    </div>
  )
}
