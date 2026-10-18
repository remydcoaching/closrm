// Objectifs — goals planned by horizon (jours, semaines, mois, trimestres,
// années, Inbox), one column per period, the parent horizon's current period
// on the right. Behaviour modelled on Timestripe's Horizons (docs/specs/2026-10-objectifs-horizons.md).
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Tabs } from '../../design-system/Tabs'
import { ErrorState, LoadingState } from '../../design-system/States'
import {
  addPeriods, cascadeShift, childHorizon, DATED_HORIZONS, formatDayRange, startsAt, type HorizonStarts, isCurrentPeriod, isoWeek, isUndated, parentHorizon, periodEnd, periodLabel,
  periodStart, shortDateLabel, todayISO, type DatedHorizon, type Horizon, type PeriodLabel,
} from './periods'
import { positionAtEnd, sortByPosition } from './ordering'
import { useGoalMutations, useGoals, useGoalsRollover, type Goal, type GoalColor } from './use-goals'
import { dropCreatesSubGoal, horizonsDown } from './goal-tree'
import { createSwipeDetector } from './swipe'
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

const COUNTER_SCOPE: Partial<Record<Horizon, string>> = { week: 'cette semaine', month: 'ce mois-ci', quarter: 'ce trimestre', year: 'cette année' }

type RepeatHorizon = 'day' | 'week' | 'month'
const REPEAT_WORD = { day: 'jour', week: 'semaine', month: 'mois' } as const
const REPEAT_PLURAL = { day: 'jours', week: 'semaines', month: 'mois' } as const

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

  useGoalsRollover(today)

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
      <HoverBoard>
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
      </HoverBoard>
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
      <HoverBoard>
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
      </HoverBoard>
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
      <HoverBoard>
        <div className="goals-columns goals-columns--fill">
          <GoalColumn horizon="inbox" start={null} current={false} all={inbox.data.goals} ops={ops} today={todayISO()} />
        </div>
      </HoverBoard>
    </>
  )
}

function HoverBoard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <HoverContext.Provider value={{ hovered, setHovered }}>
      <div className="goals-board">{children}</div>
    </HoverContext.Provider>
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
    () =>
      sortByPosition(all.filter((g) => g.horizon === horizon && g.period_start === start)),
    [all, horizon, start],
  )
  const label = labelOverride ?? columnLabel(horizon, start)

  const { hovered } = useContext(HoverContext)
  const related = useMemo(() => (hovered ? relatedTo(hovered, all) : null), [hovered, all])

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
          <GoalItem key={g.id} goal={g} all={all} ops={ops} today={today} related={related} />
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

/** Hovering a goal lights its whole chain (ancestors + descendants) in every column. */
const HoverContext = createContext<{ hovered: string | null; setHovered: (id: string | null) => void }>({
  hovered: null,
  setHovered: () => {},
})

function relatedTo(id: string, all: Goal[]): Set<string> {
  const out = new Set([id])
  const byId = new Map(all.map((g) => [g.id, g]))
  for (let p = byId.get(id)?.parent_id, d = 0; p && d < 10; p = byId.get(p)?.parent_id, d++) out.add(p)
  const stack = [id]
  for (let guard = 0; stack.length && guard < 1000; guard++) {
    const cur = stack.pop()!
    for (const g of all) if (g.parent_id === cur && !out.has(g.id)) { out.add(g.id); stack.push(g.id) }
  }
  return out
}

const MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const UNIT_PLURAL: Record<string, string> = { day: 'jours', week: 'sem.', month: 'mois', quarter: 'trim.', year: 'ans' }

/** « S43 » / « 19 oct. » / « nov. » for one planned copy, « 8 sem. » for several; full list in the tooltip. */
function plannedLabel(copies: Goal[]): { text: string; title: string } | null {
  const dated = copies.filter((c) => c.period_start && !isUndated(c.horizon))
  if (dated.length === 0) return null
  const sorted = [...dated].sort((a, b) => a.period_start!.localeCompare(b.period_start!))
  const short = (c: Goal) => {
    const [y, m, d] = c.period_start!.split('-').map(Number)
    if (c.horizon === 'week') return `S${isoWeek(c.period_start!).week}`
    if (c.horizon === 'day') return `${d} ${MONTHS_SHORT_FR[m - 1]}`
    if (c.horizon === 'month') return MONTHS_SHORT_FR[m - 1]
    if (c.horizon === 'quarter') return `T${Math.floor((m - 1) / 3) + 1}`
    return String(y)
  }
  const title = `Planifié : ${sorted.map((c) => shortDateLabel(c.horizon, c.period_start)).join(', ')}`
  if (sorted.length === 1) return { text: short(sorted[0]), title }
  const sameUnit = sorted.every((c) => c.horizon === sorted[0].horizon)
  return { text: sameUnit ? `${sorted.length} ${UNIT_PLURAL[sorted[0].horizon] ?? ''}`.trim() : `${sorted.length}×`, title }
}

const QUICK_PLAN_WORD: Partial<Record<Horizon, string>> = { week: 'Faire aujourd’hui', month: 'Faire cette semaine', quarter: 'Faire ce mois-ci', year: 'Faire ce trimestre' }

/** One level down, in the current period when it falls inside the goal's own (else its first). */
function quickPlanTarget(goal: Goal, today: string): { label: string; horizon: Horizon; period_start: string } | null {
  if (goal.done_at || !goal.period_start || isUndated(goal.horizon) || goal.horizon === 'day') return null
  const h = goal.horizon as DatedHorizon
  const child = childHorizon(h)
  const inside = today >= goal.period_start && today <= periodEnd(h, goal.period_start)
  const at = periodStart(child, inside ? today : goal.period_start)
  return { label: inside ? QUICK_PLAN_WORD[h] ?? 'Planifier' : `Planifier · ${shortDateLabel(child, at)}`, horizon: child, period_start: at }
}

function countDescendants(all: Goal[], id: string): number {
  let n = 0
  const stack = [id]
  for (let guard = 0; stack.length && guard < 1000; guard++) {
    const cur = stack.pop()!
    for (const g of all) if (g.parent_id === cur) { n++; stack.push(g.id) }
  }
  return n
}

/** Where a sub-goal of `parent` lands: one horizon down, in today's period if it falls inside the parent's. */
function childPlacement(parent: Goal, today: string): { horizon: Horizon; period_start: string | null } {
  if (parent.horizon === 'life') return { horizon: 'year', period_start: periodStart('year', today) }
  if (parent.horizon === 'inbox' || !parent.period_start) return { horizon: 'inbox', period_start: null }
  const h = childHorizon(parent.horizon)
  const inside = today >= parent.period_start && today <= periodEnd(parent.horizon, parent.period_start)
  return { horizon: h, period_start: periodStart(h, inside ? today : parent.period_start) }
}

function GoalItem({ goal, all, ops, today, related }: { goal: Goal; all: Goal[]; ops: Ops; today: string; related: Set<string> | null }) {
  const { setHovered } = useContext(HoverContext)
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(false)
  // A child with the parent's own title is this goal planned one level down
  // (dragged onto a shorter horizon), not a sub-goal: not listed nor counted.
  const direct = sortByPosition(all.filter((g) => g.parent_id === goal.id))
  const children = direct.filter((g) => g.title !== goal.title)
  // Where it is already planned one level down (same-title copies): « → S43 ».
  const plannedBadge = plannedLabel(direct.filter((g) => g.title === goal.title))
  // A copy of the goal above (same title): shown lighter, with « ↳ ».
  const parentGoal = goal.parent_id ? all.find((g) => g.id === goal.parent_id) : undefined
  const isCopy = !!parentGoal && parentGoal.title === goal.title
  // The counter shown: its own, or — on a day copy of « Poster 0/4 » — the week's, same number everywhere.
  const counterOf = goal.target ? goal : isCopy && parentGoal?.target ? parentGoal : null
  // A past period is history: its counter is read-only.
  const counterPast =
    !!counterOf && !isUndated(counterOf.horizon) && !!counterOf.period_start && periodEnd(counterOf.horizon as DatedHorizon, counterOf.period_start) < today
  const quickPlan = quickPlanTarget(goal, today)
  const descendantCount = countDescendants(all, goal.id)
  const repeatable = goal.horizon === 'day' || goal.horizon === 'week' || goal.horizon === 'month'
  const [repeatForm, setRepeatForm] = useState(false)
  const [repeatTarget, setRepeatTarget] = useState('')
  const [repeatCount, setRepeatCount] = useState('')
  function openRepeatForm() {
    // Editing: prefill with the current target and the periods left (this one included).
    setRepeatTarget(goal.target ? String(goal.target) : '')
    if (goal.repeat_until && goal.period_start && !isUndated(goal.horizon)) {
      const h = goal.horizon as RepeatHorizon
      let n = 1
      while (n < 520 && periodEnd(h, addPeriods(h, goal.period_start, n - 1)) < goal.repeat_until) n++
      setRepeatCount(String(n))
    } else setRepeatCount('')
    setRepeatForm(true)
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const done = !!goal.done_at

  function planNow() {
    if (!quickPlan) return
    setMenu(false)
    // Already planned there: nothing to add.
    if (all.some((g) => g.parent_id === goal.id && g.horizon === quickPlan.horizon && g.period_start === quickPlan.period_start && g.title === goal.title)) return
    const column = all.filter((g) => g.horizon === quickPlan.horizon && g.period_start === quickPlan.period_start)
    void ops.create({ title: goal.title, horizon: quickPlan.horizon, period_start: quickPlan.period_start, parent_id: goal.id, position: positionAtEnd(column) })
  }

  function reschedule(target: { horizon: Horizon; period_start: string | null }) {
    const column = all.filter((g) => g.horizon === target.horizon && g.period_start === target.period_start)
    void ops.update(goal.id, { ...target, position: positionAtEnd(column) })
    setMenu(false)
  }

  const dated = !isUndated(goal.horizon) && goal.period_start ? (goal.horizon as DatedHorizon) : null

  return (
    <div
      className={`goal-item${done ? ' goal-item--done' : ''}${isCopy ? ' goal-item--copy' : ''}${related ? (related.has(goal.id) ? ' goal-item--lit' : ' goal-item--dim') : ''}`}
      onMouseEnter={() => setHovered(goal.id)}
      onMouseLeave={() => setHovered(null)}
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
              {isCopy && <span className="goal-copy-mark" title="Suite de l’objectif du dessus">↳ </span>}
              {goal.repeats && <span className="goal-repeat" title="Se répète chaque période">↻ </span>}
              {goal.title}
              {plannedBadge && (
                <span className="goal-planned" title={plannedBadge.title}>
                  → {plannedBadge.text}
                </span>
              )}
            </div>
          )}
          {counterOf && (
            <div className="goal-counter">
              <span className="goal-counter-value">
                {counterOf.progress ?? 0}/{counterOf.target}
              </span>
              {!counterPast && (
                <>
                  <button
                    className="goal-counter-btn"
                    aria-label="Retirer 1"
                    disabled={(counterOf.progress ?? 0) <= 0}
                    onClick={() => void ops.update(counterOf.id, { progress: Math.max(0, (counterOf.progress ?? 0) - 1) })}
                  >
                    −
                  </button>
                  <button
                    className="goal-counter-btn"
                    aria-label="Ajouter 1"
                    onClick={() => void ops.update(counterOf.id, { progress: (counterOf.progress ?? 0) + 1 })}
                  >
                    +
                  </button>
                </>
              )}
              {counterOf.id !== goal.id && <span className="goal-counter-scope">{COUNTER_SCOPE[counterOf.horizon] ?? ''}</span>}
            </div>
          )}
          {goal.repeats && goal.repeat_until && (
            <div className="goal-time">
              ↻ jusqu’au{' '}
              {new Date(`${goal.repeat_until}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </div>
          )}
          {goal.horizon === 'day' && goal.scheduled_at && (
            <div className="goal-time">
              {new Date(goal.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · dans l’Agenda
            </div>
          )}
          {goal.carried_from && !done && (
            <div className="goal-carried">↻ Reporté · {shortDateLabel(goal.horizon, goal.carried_from)}</div>
          )}
          {(children.length > 0 || open) && (
            <button className="goal-subtoggle" onClick={() => setOpen(!open)}>
              {children.length} sous-objectif{children.length > 1 ? 's' : ''} {open ? '▴' : '▾'}
            </button>
          )}
        </div>
        {quickPlan && (
          <button className="goal-quickplan" onClick={planNow} title={quickPlan.label}>
            {quickPlan.horizon === 'day' ? 'Auj.' : '↓'}
          </button>
        )}
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
          <div className="goal-menu-backdrop" onClick={() => { setMenu(false); setConfirmDelete(false) }} />
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
            {repeatable && !repeatForm && (
              <button onClick={() => openRepeatForm()}>
                {goal.repeats ? 'Modifier la répétition' : `Répéter chaque ${REPEAT_WORD[goal.horizon as RepeatHorizon]}`}
              </button>
            )}
            {repeatable && repeatForm && (
              <form
                className="goal-repeat-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  const h = goal.horizon as RepeatHorizon
                  const n = Number(repeatTarget)
                  const count = Number(repeatCount)
                  // « pendant 8 semaines » counting this one: the series ends with the 8th.
                  const until =
                    Number.isInteger(count) && count > 0 && goal.period_start
                      ? periodEnd(h, addPeriods(h, goal.period_start, count - 1))
                      : null
                  void ops.update(goal.id, { repeats: true, target: Number.isInteger(n) && n > 0 ? n : null, repeat_until: until })
                  setRepeatForm(false)
                  setMenu(false)
                }}
              >
                <label>
                  <span>Nombre par {REPEAT_WORD[goal.horizon as RepeatHorizon]}</span>
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    value={repeatTarget}
                    onChange={(e) => setRepeatTarget(e.target.value)}
                    placeholder="ex. 4 (vide = case à cocher)"
                  />
                </label>
                <label>
                  <span>Pendant ({REPEAT_PLURAL[goal.horizon as RepeatHorizon]}, celle-ci comprise)</span>
                  <input
                    type="number"
                    min={1}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(e.target.value)}
                    placeholder="vide = sans fin"
                  />
                </label>
                <button type="submit">{goal.repeats ? 'Enregistrer' : 'Répéter'}</button>
              </form>
            )}
            {goal.repeats && (
              <button
                onClick={() => {
                  void ops.update(goal.id, { repeats: false })
                  setMenu(false)
                }}
              >
                Arrêter la répétition
              </button>
            )}
            {quickPlan && <button onClick={planNow}>{quickPlan.label}</button>}
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
                // Sub-goals go with it: say so, and ask once, before anything is lost.
                if (descendantCount > 0 && !confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                setMenu(false)
                setConfirmDelete(false)
                void ops.remove(goal.id)
              }}
            >
              {confirmDelete
                ? `Confirmer : supprimer aussi ${descendantCount} sous-objectif${descendantCount > 1 ? 's' : ''}`
                : 'Supprimer'}
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
