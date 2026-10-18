// Objectifs — goals planned by horizon (jours, semaines, mois, trimestres,
// années, Inbox), one column per period, the parent horizon's current period
// on the right. Behaviour modelled on Timestripe's Horizons (docs/specs/2026-10-objectifs-horizons.md).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Tabs } from '../../design-system/Tabs'
import { ErrorState, LoadingState } from '../../design-system/States'
import {
  addPeriods, cascadeShift, childHorizon, DATED_HORIZONS, formatDayRange, startsAt, type HorizonStarts, isCurrentPeriod, isoWeek, isUndated, parentHorizon, periodEnd, periodLabel,
  periodStart, shortDateLabel, todayISO, type DatedHorizon, type Horizon, type PeriodLabel,
} from './periods'
import { positionAtEnd, sortByPosition } from './ordering'
import { useGoalMutations, useGoals, type Goal, type GoalColor } from './use-goals'
import { dropCreatesSubGoal, horizonsDown } from './goal-tree'
import { createSwipeDetector } from './swipe'
import { api } from '../../lib/api-client'
import { invalidate } from '../../lib/query-cache'
import '../../design-system/data-table.css'
import './goals.css'

type Ops = ReturnType<typeof useGoalMutations>

type Tab = 'horizons' | DatedHorizon | 'inbox'

const TABS: { key: Tab; label: string }[] = [
  { key: 'horizons', label: 'Horizons' },
  { key: 'day', label: 'Jours' },
  { key: 'week', label: 'Semaines' },
  { key: 'month', label: 'Mois' },
  { key: 'quarter', label: 'Trimestres' },
  { key: 'year', label: 'Années' },
  { key: 'inbox', label: 'Inbox' },
]

const COLORS: { key: GoalColor; value: string }[] = [
  { key: 'yellow', value: '#e8b931' },
  { key: 'pink', value: '#e8559a' },
  { key: 'green', value: '#2f9e5b' },
  { key: 'blue', value: '#3b82f6' },
  { key: 'purple', value: '#8b5cf6' },
  { key: 'orange', value: '#f07a2b' },
]
const colorValue = (c: GoalColor | null) => COLORS.find((x) => x.key === c)?.value

const PARENT_LABEL: Record<DatedHorizon, string> = { day: 'Semaine', week: 'Mois', month: 'Trimestre', quarter: 'Année', year: '' }

/** Columns shown: the previous period, the anchor, then the next ones (they share the card width). */
const COLUMNS_BEFORE = 1
const COLUMNS_AFTER = 3

const TAB_STORAGE = 'closrm.goals.tab'

function readTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_STORAGE)
    if (v && TABS.some((t) => t.key === v)) return v as Tab
  } catch {
    /* storage unavailable */
  }
  return 'horizons'
}

function isTyping(): boolean {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
}

export function GoalsPage() {
  const [tab, setTab] = useState<Tab>(readTab)
  const today = todayISO()

  function changeTab(next: Tab) {
    setTab(next)
    try {
      localStorage.setItem(TAB_STORAGE, next)
    } catch {
      /* storage unavailable */
    }
  }

  // Like Timestripe's auto-move: unfinished goals of past periods move to the
  // current one (once per opening; the lists refresh only if something moved).
  useEffect(() => {
    api
      .post<{ moved: number }>('/api/goals/rollover', { today })
      .then((r) => {
        if (r.moved > 0) invalidate('goals:')
      })
      .catch(() => undefined)
  }, [today])

  const tabs = <Tabs items={TABS} active={tab} onChange={changeTab} />

  return (
    <div className="goals-page">
      <div className="goals-header">
        <div>
          <h1>Objectifs</h1>
          <p>Ce que tu veux accomplir aujourd’hui, cette semaine, ce mois-ci et au-delà</p>
        </div>
      </div>
      {tab === 'horizons' ? (
        <OverviewBoard today={today} tabs={tabs} />
      ) : tab === 'inbox' ? (
        <InboxBoard tabs={tabs} />
      ) : (
        <HorizonBoard key={tab} horizon={tab} today={today} tabs={tabs} />
      )}
    </div>
  )
}

function HorizonBoard({ horizon, today, tabs }: { horizon: DatedHorizon; today: string; tabs: React.ReactNode }) {
  const current = periodStart(horizon, today)
  const [anchor, setAnchor] = useState(current)
  const starts = useMemo(
    () => Array.from({ length: COLUMNS_BEFORE + 1 + COLUMNS_AFTER }, (_, i) => addPeriods(horizon, anchor, i - COLUMNS_BEFORE)),
    [horizon, anchor],
  )
  const from = starts[0]
  const to = periodEnd(horizon, starts[starts.length - 1])

  const parentH = parentHorizon(horizon)
  const parentStart = parentH ? periodStart(parentH, anchor) : null

  const main = useGoals(horizon, from, to)
  const parent = useGoals(parentH, parentStart ?? undefined, parentH && parentStart ? periodEnd(parentH, parentStart) : undefined)
  const ops = useGoalMutations([main.key, parent.key])

  // Every goal known on screen (columns + their parents and children), by id.
  const all = useMemo(() => {
    const m = new Map<string, Goal>()
    for (const g of [...(main.data?.goals ?? []), ...(parent.data?.goals ?? [])]) m.set(g.id, g)
    return [...m.values()]
  }, [main.data, parent.data])

  // A horizontal swipe slides the whole row by one period (both directions);
  // the row itself does not scroll.
  const scroller = useRef<HTMLDivElement>(null)
  useHorizontalSwipe(scroller, (dir) => setAnchor((a) => addPeriods(horizon, a, dir)))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 't' || e.key === 'T') setAnchor(current)
      else if (e.key === 'ArrowLeft') setAnchor((a) => addPeriods(horizon, a, -1))
      else if (e.key === 'ArrowRight') setAnchor((a) => addPeriods(horizon, a, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [horizon, current])

  const toolbar = (
    <div className="goals-toolbar">
      {tabs}
      <div className="goals-nav">
        <button type="button" className="goals-nav-arrow" onClick={() => setAnchor(addPeriods(horizon, anchor, -1))} aria-label="Période précédente">‹</button>
        <button type="button" className="ds-pill-button" disabled={anchor === current} onClick={() => setAnchor(current)}>
          Aujourd’hui
        </button>
        <button type="button" className="goals-nav-arrow" onClick={() => setAnchor(addPeriods(horizon, anchor, 1))} aria-label="Période suivante">›</button>
      </div>
      <span className="goals-period">{formatDayRange(from, to)}</span>
    </div>
  )

  if (!main.data && main.error) return <>{toolbar}<ErrorState message={main.error} onRetry={main.refresh} /></>
  if (!main.data) return <>{toolbar}<LoadingState /></>

  return (
    <>
      {toolbar}
      {ops.error && <ErrorBanner message={ops.error} onClose={ops.clearError} />}
      <div className="goals-board">
        <div className="goals-columns goals-columns--slide goals-columns--fill" ref={scroller}>
          {starts.map((start) => (
            <GoalColumn
              key={start}
              horizon={horizon}
              start={start}
              current={isCurrentPeriod(horizon, start, today)}
              all={all}
              ops={ops}
              today={today}
            />
          ))}
        </div>
        {parentH && parentStart && (
          <div className="goals-parent-column">
            <GoalColumn
              horizon={parentH}
              start={parentStart}
              label={{ ...columnLabel(parentH, parentStart), subtitle: `${PARENT_LABEL[horizon]} · ${columnLabel(parentH, parentStart).subtitle}` }}
              current={false}
              all={all}
              ops={ops}
              today={today}
            />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * « Horizons »: every horizon on its current period side by side —
 * Aujourd'hui · this week · this month · this quarter · this year · Vie.
 */
function OverviewBoard({ today, tabs }: { today: string; tabs: React.ReactNode }) {
  const [starts, setStarts] = useState<HorizonStarts>(() => startsAt(today))
  const d = useGoals('day', starts.day, starts.day)
  const w = useGoals('week', starts.week, starts.week)
  const m = useGoals('month', starts.month, starts.month)
  const q = useGoals('quarter', starts.quarter, starts.quarter)
  const y = useGoals('year', starts.year, starts.year)
  const life = useGoals('life')
  const queries = [d, w, m, q, y, life]
  const ops = useGoalMutations(queries.map((x) => x.key))

  const all = useMemo(() => {
    const byId = new Map<string, Goal>()
    for (const x of queries) for (const g of x.data?.goals ?? []) byId.set(g.id, g)
    return [...byId.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.data, w.data, m.data, q.data, y.data, life.data])

  const shift = (h: DatedHorizon, n: number) => setStarts((s) => cascadeShift(s, h, n, today))
  const onToday = DATED_HORIZONS.every((h) => starts[h] === startsAt(today)[h])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 't' || e.key === 'T') setStarts(startsAt(today))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [today])

  const toolbar = (
    <div className="goals-toolbar">
      {tabs}
      <button type="button" className="ds-pill-button" disabled={onToday} onClick={() => setStarts(startsAt(today))}>
        Aujourd’hui
      </button>
    </div>
  )

  const failed = queries.find((x) => !x.data && x.error)
  if (failed) return <>{toolbar}<ErrorState message={failed.error!} onRetry={() => queries.forEach((x) => void x.refresh())} /></>
  if (queries.some((x) => !x.data)) return <>{toolbar}<LoadingState /></>

  const kicker = (h: DatedHorizon, name: string, start: string): PeriodLabel => ({ ...columnLabel(h, start), subtitle: name })
  const columns: { horizon: Horizon; start: string | null; label: PeriodLabel }[] = [
    { horizon: 'day', start: starts.day, label: starts.day === today ? kicker('day', 'Aujourd’hui', starts.day) : columnLabel('day', starts.day) },
    { horizon: 'week', start: starts.week, label: columnLabel('week', starts.week) },
    { horizon: 'month', start: starts.month, label: { subtitle: 'Mois', title: `${periodLabel('month', starts.month).title} ${starts.month.slice(0, 4)}` } },
    { horizon: 'quarter', start: starts.quarter, label: kicker('quarter', 'Trimestre', starts.quarter) },
    { horizon: 'year', start: starts.year, label: columnLabel('year', starts.year) },
    { horizon: 'life', start: null, label: columnLabel('life', null) },
  ]

  return (
    <>
      {toolbar}
      {ops.error && <ErrorBanner message={ops.error} onClose={ops.clearError} />}
      <div className="goals-board">
        <div className="goals-columns goals-columns--fill">
          {columns.map((c) => (
            <GoalColumn
              key={c.horizon}
              horizon={c.horizon}
              start={c.start}
              label={c.label}
              current={!isUndated(c.horizon) && c.start !== null && isCurrentPeriod(c.horizon as DatedHorizon, c.start, today)}
              all={all}
              ops={ops}
              today={today}
              onShift={isUndated(c.horizon) ? undefined : (n) => shift(c.horizon as DatedHorizon, n)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * Horizontal trackpad swipe on an element → onSwipe(+1 | -1), once per gesture
 * (the trackpad's inertia keeps sending wheel events after the fingers lift).
 */
function useHorizontalSwipe(ref: React.RefObject<HTMLElement | null>, onSwipe: ((dir: 1 | -1) => void) | undefined) {
  const cb = useRef(onSwipe)
  cb.current = onSwipe
  const enabled = !!onSwipe
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const detector = createSwipeDetector()
    function onWheel(e: WheelEvent) {
      // Vertical scroll stays native. Everything else is ours — including the
      // zero-delta first event of a trackpad gesture: if that one is not
      // cancelled, Chromium makes the whole gesture uncancelable and a swipe
      // right at the left edge becomes macOS « back » navigation.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return
      e.preventDefault()
      const dir = detector.feed(e.deltaX, e.deltaY, performance.now())
      if (dir !== 0) cb.current?.(dir)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, enabled])
}

function InboxBoard({ tabs }: { tabs: React.ReactNode }) {
  const inbox = useGoals('inbox')
  const ops = useGoalMutations([inbox.key])
  const toolbar = (
    <div className="goals-toolbar">
      {tabs}
    </div>
  )
  if (!inbox.data && inbox.error) return <>{toolbar}<ErrorState message={inbox.error} onRetry={inbox.refresh} /></>
  if (!inbox.data) return <>{toolbar}<LoadingState /></>
  return (
    <>
      {toolbar}
      {ops.error && <ErrorBanner message={ops.error} onClose={ops.clearError} />}
      <div className="goals-board">
        <div className="goals-columns goals-columns--fill">
          <GoalColumn horizon="inbox" start={null} current={false} all={inbox.data.goals} ops={ops} today={todayISO()} />
        </div>
      </div>
    </>
  )
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="goals-error">
      <span>{message}</span>
      <button onClick={onClose} aria-label="Fermer">×</button>
    </div>
  )
}

/** Column header: `subtitle` is the small grey line on top, `title` the bold one. */
function columnLabel(horizon: Horizon, start: string | null): PeriodLabel {
  if (horizon === 'life') return { subtitle: 'Long terme', title: 'Vie' }
  if (horizon === 'inbox' || !start) return { subtitle: 'Sans date', title: 'Inbox' }
  const l = periodLabel(horizon, start)
  switch (horizon) {
    case 'day': return { subtitle: l.title, title: l.subtitle } // « Jeudi » / « 15 octobre »
    case 'week': return { subtitle: `Semaine ${isoWeek(start).week}`, title: l.subtitle }
    case 'month': return { subtitle: l.subtitle, title: l.title } // « 2026 » / « Octobre »
    case 'quarter': return { subtitle: l.subtitle, title: l.title } // « oct.–déc. » / « T4 2026 »
    case 'year': return { subtitle: 'Année', title: l.title }
  }
}

interface ColumnProps {
  horizon: Horizon
  start: string | null
  current: boolean
  all: Goal[]
  ops: Ops
  today: string
  /** Overrides the default column header (« Horizons » view). */
  label?: PeriodLabel
  /** « Horizons » view: slide this column by n periods (swipe or ‹ ›). */
  onShift?: (n: number) => void
}

function GoalColumn({ horizon, start, current, all, ops, today, label: labelOverride, onShift }: ColumnProps) {
  const sectionRef = useRef<HTMLElement>(null)
  useHorizontalSwipe(sectionRef, onShift)
  const [dragOver, setDragOver] = useState(false)
  const goals = useMemo(
    () => sortByPosition(all.filter((g) => g.horizon === horizon && g.period_start === start)),
    [all, horizon, start],
  )
  const label = labelOverride ?? columnLabel(horizon, start)

  /**
   * Year goal dropped on a week: one sub-goal per level in between (quarter,
   * month, then the week), each reusing the slice that already exists there.
   */
  async function planDown(goal: Goal) {
    let parentId = goal.id
    for (const h of horizonsDown(goal.horizon, horizon)) {
      const at = h === horizon ? start : isUndated(h) || !start ? null : periodStart(h as DatedHorizon, start)
      const existing = all.find((g) => g.parent_id === parentId && g.horizon === h && g.period_start === at && g.title === goal.title)
      if (existing) {
        parentId = existing.id
        continue
      }
      const column = all.filter((g) => g.horizon === h && g.period_start === at)
      const created = await ops.create({ title: goal.title, horizon: h, period_start: at, parent_id: parentId, position: positionAtEnd(column) })
      if (!created) return
      parentId = created.id
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData('text/goal-id')
    const goal = all.find((g) => g.id === id)
    if (!goal || (goal.horizon === horizon && goal.period_start === start)) return
    if (dropCreatesSubGoal(goal.horizon, horizon)) {
      // Month goal dropped on a week: plan a slice of it there, it stays in the month.
      void planDown(goal)
      return
    }
    void ops.update(id, { horizon, period_start: start, position: positionAtEnd(goals) })
  }

  return (
    <section
      ref={sectionRef}
      className={`goals-column${dragOver ? ' goals-column--over' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/goal-id')) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <header className={`goals-column-head${current ? ' goals-column-head--current' : ''}`}>
        <div className="goals-column-sub">{label.subtitle || ' '}</div>
        <div className="goals-column-title-row">
          <div className="goals-column-title">{label.title}</div>
          {onShift && (
            <div className="goals-column-arrows">
              <button onClick={() => onShift(-1)} aria-label="Période précédente">‹</button>
              <button onClick={() => onShift(1)} aria-label="Période suivante">›</button>
            </div>
          )}
        </div>
      </header>
      <div className="goals-list">
        {goals.map((g) => (
          <GoalItem key={g.id} goal={g} all={all} ops={ops} today={today} />
        ))}
        <GoalComposer
          onSubmit={(title) =>
            ops.create({ title, horizon, period_start: start, position: positionAtEnd(goals) })
          }
        />
      </div>
    </section>
  )
}

/** Where a sub-goal of `parent` lands: one horizon down, in today's period if it falls inside the parent's. */
function childPlacement(parent: Goal, today: string): { horizon: Horizon; period_start: string | null } {
  if (parent.horizon === 'life') return { horizon: 'year', period_start: periodStart('year', today) }
  if (parent.horizon === 'inbox' || !parent.period_start) return { horizon: 'inbox', period_start: null }
  const h = childHorizon(parent.horizon)
  const inside = today >= parent.period_start && today <= periodEnd(parent.horizon, parent.period_start)
  return { horizon: h, period_start: periodStart(h, inside ? today : parent.period_start) }
}

function GoalItem({ goal, all, ops, today }: { goal: Goal; all: Goal[]; ops: Ops; today: string }) {
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(false)
  const parent = goal.parent_id ? all.find((g) => g.id === goal.parent_id) : undefined
  const children = sortByPosition(all.filter((g) => g.parent_id === goal.id))
  const done = !!goal.done_at

  function reschedule(target: { horizon: Horizon; period_start: string | null }) {
    const column = all.filter((g) => g.horizon === target.horizon && g.period_start === target.period_start)
    void ops.update(goal.id, { ...target, position: positionAtEnd(column) })
    setMenu(false)
  }

  const dated = !isUndated(goal.horizon) && goal.period_start ? (goal.horizon as DatedHorizon) : null

  return (
    <div
      className={`goal-item${done ? ' goal-item--done' : ''}`}
      style={{ borderLeftColor: colorValue(goal.color) ?? 'transparent' }}
      draggable={!editing && !goal.id.startsWith('tmp-')}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/goal-id', goal.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="goal-row">
        <Check done={done} onToggle={() => void ops.update(goal.id, { done: !done })} />
        <div className="goal-body">
          {editing ? (
            <TitleInput
              initial={goal.title}
              onDone={(title) => {
                setEditing(false)
                if (title && title !== goal.title) void ops.update(goal.id, { title })
              }}
            />
          ) : (
            <div className="goal-title" onClick={() => setEditing(true)}>
              {goal.title}
            </div>
          )}
          {goal.carried_from && !done && (
            <div className="goal-carried">↻ Reporté · {shortDateLabel(goal.horizon, goal.carried_from)}</div>
          )}
          {parent && <div className="goal-parent">{parent.title}</div>}
          {(children.length > 0 || open) && (
            <button className="goal-subtoggle" onClick={() => setOpen(!open)}>
              {children.length} sous-objectif{children.length > 1 ? 's' : ''} {open ? '▴' : '▾'}
            </button>
          )}
        </div>
        <button className="goal-more" onClick={() => setMenu(!menu)} aria-label="Options">
          ⋯
        </button>
      </div>

      {open && (
        <div className="goal-children">
          {children.map((c) => (
            <div key={c.id} className={`goal-child${c.done_at ? ' goal-item--done' : ''}`}>
              <Check done={!!c.done_at} onToggle={() => void ops.update(c.id, { done: !c.done_at })} />
              <div className="goal-body">
                <div className="goal-title goal-title--static">{c.title}</div>
                <div className="goal-parent">{shortDateLabel(c.horizon, c.period_start)}</div>
              </div>
            </div>
          ))}
          <GoalComposer
            onSubmit={(title) => {
              const place = childPlacement(goal, today)
              const column = all.filter((g) => g.horizon === place.horizon && g.period_start === place.period_start)
              return ops.create({ title, ...place, parent_id: goal.id, position: positionAtEnd(column) })
            }}
          />
        </div>
      )}

      {menu && (
        <>
          <div className="goal-menu-backdrop" onClick={() => setMenu(false)} />
          <div className="goal-menu" role="menu">
            <div className="goal-menu-colors">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  className={`goal-color${goal.color === c.key ? ' goal-color--active' : ''}`}
                  style={{ background: c.value }}
                  aria-label={c.key}
                  onClick={() => {
                    void ops.update(goal.id, { color: goal.color === c.key ? null : c.key })
                    setMenu(false)
                  }}
                />
              ))}
            </div>
            {dated && goal.period_start && (
              <>
                <button onClick={() => reschedule({ horizon: dated, period_start: addPeriods(dated, goal.period_start!, -1) })}>
                  Période précédente
                </button>
                <button onClick={() => reschedule({ horizon: dated, period_start: addPeriods(dated, goal.period_start!, 1) })}>
                  Période suivante
                </button>
                <button onClick={() => reschedule({ horizon: 'inbox', period_start: null })}>Déplacer vers l’Inbox</button>
              </>
            )}
            {!dated && (
              <>
                <button onClick={() => reschedule({ horizon: 'day', period_start: today })}>Planifier aujourd’hui</button>
                <button onClick={() => reschedule({ horizon: 'week', period_start: periodStart('week', today) })}>Planifier cette semaine</button>
                <button onClick={() => reschedule({ horizon: 'month', period_start: periodStart('month', today) })}>Planifier ce mois-ci</button>
              </>
            )}
            <button
              onClick={() => {
                setOpen(true)
                setMenu(false)
              }}
            >
              Ajouter un sous-objectif
            </button>
            {goal.parent_id && (
              <button
                onClick={() => {
                  void ops.update(goal.id, { parent_id: null })
                  setMenu(false)
                }}
              >
                Détacher de l’objectif parent
              </button>
            )}
            <button
              className="goal-menu-danger"
              onClick={() => {
                setMenu(false)
                void ops.remove(goal.id)
              }}
            >
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Check({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button className={`goal-check${done ? ' goal-check--done' : ''}`} aria-pressed={done} aria-label={done ? 'Décocher' : 'Cocher'} onClick={onToggle}>
      {done && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  )
}

function TitleInput({ initial, onDone }: { initial: string; onDone: (title: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <input
      className="goal-input"
      autoFocus
      value={value}
      maxLength={500}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value.trim())
        if (e.key === 'Escape') onDone(initial)
      }}
      onBlur={() => onDone(value.trim())}
    />
  )
}

/** « Ajouter… »: Enter creates and keeps the field open for the next one, Escape closes. */
function GoalComposer({ onSubmit }: { onSubmit: (title: string) => unknown }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button className="goal-add" onClick={() => setOpen(true)}>
        <span className="goal-add-plus">+</span>
        Ajouter
      </button>
    )
  }
  return (
    <div className="goal-composer">
      <span className="goal-check goal-check--ghost" />
      <input
        className="goal-input"
        autoFocus
        value={value}
        maxLength={500}
        placeholder="Nouvel objectif"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            void onSubmit(value.trim())
            setValue('')
          }
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (value.trim()) void onSubmit(value.trim())
          setValue('')
          setOpen(false)
        }}
      />
      <span className="goal-composer-hint">Entrée</span>
    </div>
  )
}
