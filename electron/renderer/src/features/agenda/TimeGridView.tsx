// Week / Day grid — port of the web's components/agenda/v2/WeekView + DayView:
// 24h grid (64 px/h), quarter-hour snapping, overlapping events side by side,
// now indicator, click-on-slot / drag-to-create, drag-to-move and
// bottom-edge resize for bookings. Click 1 = highlight, click 2 = detail (the
// page decides — we only report clicks).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  GRID_HEIGHT,
  PX_PER_MINUTE,
  addMinutes,
  computeOverlapLayout,
  eventToPosition,
  eventsForDay,
  formatDayHeader,
  hourToHHmm,
  isAllDay,
  isSameDay,
  pixelToHour,
  snapToQuarter,
  toTimeInput,
} from './agenda-utils'
import type { AgendaEvent } from './types'

/** A day goal (Objectifs) shown in the Agenda: in the day's strip, or placed at a time. */
export interface AgendaGoal {
  id: string
  title: string
  done: boolean
  /** Its day, "YYYY-MM-DD" (local). */
  day: string
  scheduledAt: string | null
  durationMinutes: number
}

const GOAL_DEFAULT_MINUTES = 60

/** Local "YYYY-MM-DD" of a grid day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface TimeGridViewProps {
  days: Date[]
  events: AgendaEvent[]
  highlightedId: string | null
  onEventClick: (ev: AgendaEvent) => void
  onSlotCreate: (day: Date, hour: number, durationMinutes?: number) => void
  onEventMove: (ev: AgendaEvent, newScheduledAt: string) => void
  onEventResize: (ev: AgendaEvent, newDurationMinutes: number) => void
  onDayHeaderClick?: (day: Date) => void
  onHoverChange?: (day: Date | null, hour: number | null) => void
  /** Day goals: the « Objectifs » strip above the grid, and the placed ones in it. */
  goals?: AgendaGoal[]
  /** Place a goal (scheduledAt = null: back to the strip of `day`). */
  onGoalSchedule?: (id: string, day: string, scheduledAt: string | null, durationMinutes: number) => void
  onGoalToggle?: (id: string) => void
}

type Drag =
  | { kind: 'create'; dayIdx: number; anchor: number; current: number; moved: boolean }
  | { kind: 'move'; ev: AgendaEvent; dayIdx: number; startHour: number; offsetMin: number; originX: number; originY: number; moved: boolean }
  | { kind: 'resize'; ev: AgendaEvent; endHour: number; startHour: number; moved: boolean }
  | { kind: 'goal'; goal: AgendaGoal; dayIdx: number; startHour: number; offsetMin: number; overStrip: boolean; originX: number; originY: number; moved: boolean }
  | { kind: 'goalResize'; goal: AgendaGoal; startHour: number; endHour: number; moved: boolean }

const DRAG_THRESHOLD_PX = 4

function isDraggable(ev: AgendaEvent): boolean {
  return ev.kind === 'booking' && !ev.id.startsWith('tmp-')
}

export function eventBackground(ev: AgendaEvent): string {
  const isPending = ev.kind === 'booking' && ev.booking.status === 'pending'
  const isFree = ev.kind === 'booking' && ev.booking.blocks_availability === false
  const base = `color-mix(in srgb, ${ev.color} ${isPending ? 10 : 20}%, var(--color-surface))`
  if (isFree) {
    const alt = `color-mix(in srgb, ${ev.color} 7%, var(--color-surface))`
    return `repeating-linear-gradient(135deg, ${base} 0 8px, ${alt} 8px 16px)`
  }
  return base
}

export function eventBoxShadow(ev: AgendaEvent, highlighted: boolean): string {
  const bar = `inset 3px 0 0 ${ev.color}`
  if (highlighted) return `${bar}, inset 0 0 0 1.5px ${ev.color}, 0 0 0 2px color-mix(in srgb, ${ev.color} 40%, transparent)`
  return `${bar}, inset 0 0 0 1px color-mix(in srgb, ${ev.color} 30%, transparent)`
}

export function TimeGridView({
  days,
  events,
  highlightedId,
  onEventClick,
  onSlotCreate,
  onEventMove,
  onEventResize,
  onDayHeaderClick,
  onHoverChange,
  goals,
  onGoalSchedule,
  onGoalToggle,
}: TimeGridViewProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClickRef = useRef(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // Initial scroll: an hour before now when today is visible, else 8:00.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const todayVisible = days.some((d) => isSameDay(d, new Date()))
    const target = todayVisible ? Math.max(0, new Date().getHours() - 1) : 8
    body.scrollTop = target * 60 * PX_PER_MINUTE
    // Only on mount / when the visible range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]?.getTime(), days.length])

  const timedByDay = useMemo(
    () => days.map((d) => eventsForDay(events, d).filter((ev) => !isAllDay(ev))),
    [days, events],
  )
  const allDayByDay = useMemo(
    () =>
      days.map((d) =>
        events.filter((ev) => {
          if (!isAllDay(ev)) return false
          const start = new Date(ev.start)
          const end = addMinutes(start, ev.durationMinutes)
          const dayStart = new Date(d)
          dayStart.setHours(0, 0, 0, 0)
          return start.getTime() < dayStart.getTime() + 86_400_000 && end.getTime() > dayStart.getTime()
        }),
      ),
    [days, events],
  )
  const hasAllDay = allDayByDay.some((l) => l.length > 0)

  const goalsByDay = useMemo(
    () =>
      days.map((d) => {
        const key = dayKey(d)
        const mine = (goals ?? []).filter((g) => g.day === key)
        return { strip: mine.filter((g) => !g.scheduledAt), placed: mine.filter((g) => g.scheduledAt) }
      }),
    [days, goals],
  )

  const pointerToGrid = useCallback(
    (clientX: number, clientY: number): { dayIdx: number; hour: number } | null => {
      const el = columnsRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const colWidth = rect.width / days.length
      const dayIdx = Math.min(days.length - 1, Math.max(0, Math.floor((clientX - rect.left) / colWidth)))
      const hour = Math.min(24, Math.max(0, pixelToHour(clientY - rect.top)))
      return { dayIdx, hour }
    },
    [days.length],
  )

  const updateDrag = (next: Drag | null) => {
    dragRef.current = next
    setDrag(next)
  }

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const pos = pointerToGrid(e.clientX, e.clientY)
      if (!pos) return
      if (d.kind === 'create') {
        const current = snapToQuarter(pos.hour)
        updateDrag({ ...d, current, moved: d.moved || current !== d.anchor })
      } else if (d.kind === 'move') {
        const moved = d.moved || Math.abs(e.clientX - d.originX) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - d.originY) > DRAG_THRESHOLD_PX
        if (!moved) return
        const startHour = Math.min(24 - d.ev.durationMinutes / 60, Math.max(0, snapToQuarter(pos.hour - d.offsetMin / 60)))
        updateDrag({ ...d, dayIdx: pos.dayIdx, startHour, moved: true })
      } else if (d.kind === 'goal') {
        const moved = d.moved || Math.abs(e.clientX - d.originX) > DRAG_THRESHOLD_PX || Math.abs(e.clientY - d.originY) > DRAG_THRESHOLD_PX
        if (!moved) return
        const stripBottom = stripRef.current?.getBoundingClientRect().bottom ?? -Infinity
        const overStrip = e.clientY <= stripBottom
        const startHour = Math.min(24 - d.goal.durationMinutes / 60, Math.max(0, snapToQuarter(pos.hour - d.offsetMin / 60)))
        updateDrag({ ...d, dayIdx: pos.dayIdx, startHour, overStrip, moved: true })
      } else if (d.kind === 'goalResize') {
        const endHour = Math.max(d.startHour + 0.25, Math.min(24, snapToQuarter(pos.hour)))
        updateDrag({ ...d, endHour, moved: true })
      } else {
        const endHour = Math.max(d.startHour + 0.25, Math.min(24, snapToQuarter(pos.hour)))
        updateDrag({ ...d, endHour, moved: true })
      }
    }
    function onUp() {
      const d = dragRef.current
      updateDrag(null)
      if (!d) return
      if (d.kind === 'create') {
        const day = days[d.dayIdx]
        if (!d.moved) {
          onSlotCreate(day, d.anchor)
          return
        }
        const start = Math.min(d.anchor, d.current)
        const end = Math.max(d.anchor, d.current)
        onSlotCreate(day, start, Math.max(15, Math.round((end - start) * 60)))
      } else if (d.kind === 'move') {
        if (!d.moved) return // plain click → onClick handles it
        suppressClickRef.current = true
        const day = new Date(days[d.dayIdx])
        const totalMin = Math.round(d.startHour * 60)
        day.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0)
        if (day.getTime() !== new Date(d.ev.start).getTime()) onEventMove(d.ev, day.toISOString())
      } else if (d.kind === 'goal') {
        if (!d.moved) return
        const key = dayKey(days[d.dayIdx])
        if (d.overStrip) {
          if (d.goal.scheduledAt || key !== d.goal.day) onGoalSchedule?.(d.goal.id, key, null, d.goal.durationMinutes)
          return
        }
        const at = new Date(days[d.dayIdx])
        const totalMin = Math.round(d.startHour * 60)
        at.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0)
        onGoalSchedule?.(d.goal.id, key, at.toISOString(), d.goal.durationMinutes)
      } else if (d.kind === 'goalResize') {
        const duration = Math.max(15, Math.round((d.endHour - d.startHour) * 60))
        if (duration !== d.goal.durationMinutes) onGoalSchedule?.(d.goal.id, d.goal.day, d.goal.scheduledAt, duration)
      } else {
        suppressClickRef.current = true
        const duration = Math.max(15, Math.round((d.endHour - d.startHour) * 60))
        if (duration !== d.ev.durationMinutes) onEventResize(d.ev, duration)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // `drag` presence toggles the listeners; the live value is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null, days, pointerToGrid, onSlotCreate, onEventMove, onEventResize, onGoalSchedule])

  function onGoalMouseDown(e: React.MouseEvent, goal: AgendaGoal, dayIdx: number) {
    e.stopPropagation()
    if (e.button !== 0 || goal.id.startsWith('tmp-')) return
    const start = goal.scheduledAt ? new Date(goal.scheduledAt) : null
    const startHour = start ? start.getHours() + start.getMinutes() / 60 : 9
    if ((e.target as HTMLElement).dataset.resizeHandle === 'bottom' && start) {
      updateDrag({ kind: 'goalResize', goal, startHour, endHour: startHour + goal.durationMinutes / 60, moved: false })
      return
    }
    const pos = pointerToGrid(e.clientX, e.clientY)
    // From the strip the pointer holds the block's top; in the grid, where it was grabbed.
    const offsetMin = start && pos ? (pos.hour - startHour) * 60 : 0
    updateDrag({ kind: 'goal', goal, dayIdx, startHour, offsetMin, overStrip: !start, originX: e.clientX, originY: e.clientY, moved: false })
  }

  function onColumnMouseDown(e: React.MouseEvent, dayIdx: number) {
    if (e.button !== 0) return
    const pos = pointerToGrid(e.clientX, e.clientY)
    if (!pos) return
    const anchor = Math.min(23.75, Math.floor(pos.hour * 4) / 4)
    updateDrag({ kind: 'create', dayIdx, anchor, current: anchor, moved: false })
  }

  function onEventMouseDown(e: React.MouseEvent, ev: AgendaEvent, dayIdx: number) {
    e.stopPropagation()
    if (e.button !== 0 || !isDraggable(ev)) return
    const pos = pointerToGrid(e.clientX, e.clientY)
    if (!pos) return
    const start = new Date(ev.start)
    const startHour = start.getHours() + start.getMinutes() / 60
    const isResize = (e.target as HTMLElement).dataset.resizeHandle === 'bottom'
    if (isResize) {
      updateDrag({ kind: 'resize', ev, startHour, endHour: startHour + ev.durationMinutes / 60, moved: false })
      return
    }
    updateDrag({
      kind: 'move',
      ev,
      dayIdx,
      startHour,
      offsetMin: (pos.hour - startHour) * 60,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
    })
  }

  function handleEventClick(ev: AgendaEvent) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onEventClick(ev)
  }

  function onColumnHover(e: React.MouseEvent) {
    if (!onHoverChange) return
    const pos = pointerToGrid(e.clientX, e.clientY)
    onHoverChange(pos ? days[pos.dayIdx] : null, pos ? pos.hour : null)
  }

  const nowTop = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE

  return (
    <div className="agenda-grid">
      <div className="agenda-grid-head">
        <div className="agenda-gutter" />
        {days.map((d) => {
          const h = formatDayHeader(d)
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={`agenda-day-head ${isSameDay(d, now) ? 'agenda-day-head--today' : ''}`}
              onClick={() => onDayHeaderClick?.(d)}
            >
              <div className="agenda-day-head-weekday">{h.weekday}</div>
              <span className="agenda-day-head-num">{h.day}</span>
            </button>
          )
        })}
      </div>

      {hasAllDay && (
        <div className="agenda-allday">
          <div className="agenda-allday-label">Journée</div>
          {allDayByDay.map((list, i) => (
            <div key={i} className="agenda-allday-cell">
              {list.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className="agenda-allday-chip"
                  style={{ background: eventBackground(ev), boxShadow: eventBoxShadow(ev, highlightedId === ev.id) }}
                  onClick={() => onEventClick(ev)}
                  title={ev.title}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {goals && (
        <div className="agenda-goal-strip" ref={stripRef}>
          <div className="agenda-allday-label">Objectifs</div>
          {goalsByDay.map(({ strip }, i) => {
            const dropHere = drag?.kind === 'goal' && drag.moved && drag.overStrip && drag.dayIdx === i
            return (
              <div key={i} className={`agenda-goal-strip-cell${dropHere ? ' agenda-goal-strip-cell--over' : ''}`}>
                {strip.map((g) => (
                  <div
                    key={g.id}
                    className={`agenda-goal-chip${g.done ? ' agenda-goal-chip--done' : ''}${drag?.kind === 'goal' && drag.moved && drag.goal.id === g.id ? ' agenda-goal-chip--dragging' : ''}`}
                    title={`${g.title} — glisse-le dans la grille pour le placer à une heure`}
                    onMouseDown={(e) => onGoalMouseDown(e, g, i)}
                  >
                    <GoalCheck done={g.done} onToggle={() => onGoalToggle?.(g.id)} />
                    <span className="agenda-goal-chip-title">{g.title}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <div className="agenda-grid-body" ref={bodyRef}>
        <div className="agenda-hours" style={{ height: GRID_HEIGHT }}>
          {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
            <span key={h} className="agenda-hour-label" style={{ top: h * 60 * PX_PER_MINUTE }}>
              {hourToHHmm(h)}
            </span>
          ))}
        </div>
        <div
          className="agenda-columns"
          ref={columnsRef}
          style={{ height: GRID_HEIGHT }}
          onMouseMove={onColumnHover}
          onMouseLeave={() => onHoverChange?.(null, null)}
        >
          {days.map((day, dayIdx) => {
            const dayEvents = timedByDay[dayIdx]
            const placedGoals = goalsByDay[dayIdx].placed
            // Goals share the columns with events when they overlap.
            const layout = computeOverlapLayout([
              ...dayEvents,
              ...placedGoals.map((g) => ({ id: `goal-${g.id}`, start: g.scheduledAt!, durationMinutes: g.durationMinutes })),
            ])
            const today = isSameDay(day, now)
            return (
              <div
                key={day.toISOString()}
                className={`agenda-column ${today ? 'agenda-column--today' : ''}`}
                onMouseDown={(e) => onColumnMouseDown(e, dayIdx)}
              >
                {today && <div className="agenda-now" style={{ top: nowTop }} />}

                {dayEvents.map((ev) => {
                  const pos = eventToPosition(ev.start, ev.durationMinutes)
                  const lay = layout.get(ev.id) ?? { column: 0, groupSize: 1 }
                  const width = 100 / lay.groupSize
                  const beingMoved = drag?.kind === 'move' && drag.moved && drag.ev.id === ev.id
                  const beingResized = drag?.kind === 'resize' && drag.ev.id === ev.id
                  const height = beingResized
                    ? Math.max(8, (drag.endHour - drag.startHour) * 60 * PX_PER_MINUTE - 2)
                    : pos.height
                  const duration = beingResized ? Math.round((drag.endHour - drag.startHour) * 60) : ev.durationMinutes
                  return (
                    <EventBlock
                      key={ev.id}
                      ev={ev}
                      style={{
                        top: pos.top,
                        height,
                        left: `calc(${lay.column * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      durationMinutes={duration}
                      highlighted={highlightedId === ev.id}
                      dragging={beingMoved}
                      onMouseDown={(e) => onEventMouseDown(e, ev, dayIdx)}
                      onClick={() => handleEventClick(ev)}
                    />
                  )
                })}

                {placedGoals.map((g) => {
                  const pos = eventToPosition(g.scheduledAt!, g.durationMinutes)
                  const lay = layout.get(`goal-${g.id}`) ?? { column: 0, groupSize: 1 }
                  const width = 100 / lay.groupSize
                  const moving = drag?.kind === 'goal' && drag.moved && drag.goal.id === g.id
                  const resizing = drag?.kind === 'goalResize' && drag.goal.id === g.id
                  const minutes = resizing ? Math.round((drag.endHour - drag.startHour) * 60) : g.durationMinutes
                  return (
                    <GoalBlock
                      key={`goal-${g.id}`}
                      goal={g}
                      minutes={minutes}
                      dragging={moving}
                      style={{
                        top: pos.top,
                        height: Math.max(18, minutes * PX_PER_MINUTE - 2),
                        left: `calc(${lay.column * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      onMouseDown={(e) => onGoalMouseDown(e, g, dayIdx)}
                      onToggle={() => onGoalToggle?.(g.id)}
                    />
                  )
                })}

                {drag?.kind === 'goal' && drag.moved && !drag.overStrip && drag.dayIdx === dayIdx && (
                  <GoalBlock
                    goal={drag.goal}
                    ghost
                    minutes={drag.goal.durationMinutes}
                    startHour={drag.startHour}
                    style={{
                      top: drag.startHour * 60 * PX_PER_MINUTE,
                      height: Math.max(18, drag.goal.durationMinutes * PX_PER_MINUTE - 2),
                      left: 2,
                      right: 2,
                    }}
                  />
                )}

                {drag?.kind === 'move' && drag.moved && drag.dayIdx === dayIdx && (
                  <EventBlock
                    ev={drag.ev}
                    ghost
                    startOverride={drag.startHour}
                    durationMinutes={drag.ev.durationMinutes}
                    style={{
                      top: drag.startHour * 60 * PX_PER_MINUTE,
                      height: Math.max(8, drag.ev.durationMinutes * PX_PER_MINUTE - 2),
                      left: 2,
                      right: 2,
                    }}
                  />
                )}

                {drag?.kind === 'create' && drag.dayIdx === dayIdx && drag.moved && (
                  <div
                    className="agenda-create-ghost"
                    style={{
                      top: Math.min(drag.anchor, drag.current) * 60 * PX_PER_MINUTE,
                      height: Math.max(15, Math.abs(drag.current - drag.anchor) * 60) * PX_PER_MINUTE,
                    }}
                  >
                    {hourToHHmm(Math.min(drag.anchor, drag.current))} – {hourToHHmm(Math.max(drag.anchor, drag.current))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GoalCheck({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`agenda-goal-check${done ? ' agenda-goal-check--done' : ''}`}
      aria-label={done ? 'Décocher' : 'Cocher'}
      aria-pressed={done}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {done && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  )
}

/** A placed goal: lighter than a booking (dashed edge), its own checkbox, resizable. */
function GoalBlock({
  goal,
  style,
  minutes,
  dragging = false,
  ghost = false,
  startHour,
  onMouseDown,
  onToggle,
}: {
  goal: AgendaGoal
  style: React.CSSProperties
  minutes: number
  dragging?: boolean
  ghost?: boolean
  startHour?: number
  onMouseDown?: (e: React.MouseEvent) => void
  onToggle?: () => void
}) {
  const start = startHour !== undefined ? hourToHHmm(startHour) : goal.scheduledAt ? toTimeInput(new Date(goal.scheduledAt)) : ''
  const classes = ['agenda-goal-block', goal.done ? 'agenda-goal-block--done' : '', dragging ? 'agenda-goal-block--dragging' : '', ghost ? 'agenda-goal-block--ghost' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} style={style} onMouseDown={onMouseDown} title={goal.title}>
      <div className="agenda-goal-block-row">
        {!ghost && <GoalCheck done={goal.done} onToggle={() => onToggle?.()} />}
        <span className="agenda-goal-block-title">{goal.title}</span>
      </div>
      {minutes > 30 && <span className="agenda-goal-block-time">{start}</span>}
      {!ghost && <span className="agenda-event-resize" data-resize-handle="bottom" />}
    </div>
  )
}

function EventBlock({
  ev,
  style,
  durationMinutes,
  highlighted = false,
  dragging = false,
  ghost = false,
  startOverride,
  onMouseDown,
  onClick,
}: {
  ev: AgendaEvent
  style: React.CSSProperties
  durationMinutes: number
  highlighted?: boolean
  dragging?: boolean
  ghost?: boolean
  startOverride?: number
  onMouseDown?: (e: React.MouseEvent) => void
  onClick?: () => void
}) {
  const start = startOverride !== undefined ? hourToHHmm(startOverride) : toTimeInput(new Date(ev.start))
  const startDate = new Date(ev.start)
  if (startOverride !== undefined) {
    const m = Math.round(startOverride * 60)
    startDate.setHours(Math.floor(m / 60), m % 60, 0, 0)
  }
  const end = toTimeInput(addMinutes(startDate, durationMinutes))
  const short = durationMinutes <= 30
  const isPending = ev.kind === 'booking' && ev.booking.status === 'pending'
  const isCancelled = ev.kind === 'booking' ? ev.booking.status === 'cancelled' : ev.call.outcome === 'cancelled'
  const classes = [
    'agenda-event',
    short ? 'agenda-event--short' : '',
    dragging ? 'agenda-event--dragging' : '',
    ghost ? 'agenda-event--ghost' : '',
    isCancelled ? 'agenda-event--cancelled' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={classes}
      title={`${ev.title} · ${start}–${end}${ev.subtitle ? ` · ${ev.subtitle}` : ''}`}
      style={{
        ...style,
        background: eventBackground(ev),
        boxShadow: eventBoxShadow(ev, highlighted),
        outline: isPending ? `1.5px dashed ${ev.color}` : undefined,
        outlineOffset: isPending ? -1 : undefined,
      }}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      <span className="agenda-event-title">{ev.title}</span>
      <span className="agenda-event-time">
        {start}–{end}
      </span>
      {!short && durationMinutes >= 60 && ev.subtitle && <span className="agenda-event-sub">{ev.subtitle}</span>}
      {!ghost && isDraggable(ev) && <span className="agenda-event-resize" data-resize-handle="bottom" />}
    </button>
  )
}
