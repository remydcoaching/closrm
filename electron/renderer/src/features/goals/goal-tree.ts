// Rules between a goal and its sub-goals.
import { addDaysISO, childHorizon, isUndated, periodEnd, periodStart, todayISO, type DatedHorizon, type Horizon } from './periods'

const RANK: Partial<Record<Horizon, number>> = { day: 0, week: 1, month: 2, quarter: 3, year: 4, life: 5 }

/**
 * Dropping a goal on a SHORTER horizon (month goal → a week) plans a slice of
 * it: a linked sub-goal is created there and the goal stays where it is.
 * Same or longer horizon, or anything from/to the Inbox: the goal moves.
 */
export function dropCreatesSubGoal(source: Horizon, target: Horizon): boolean {
  const s = RANK[source]
  const t = RANK[target]
  return s !== undefined && t !== undefined && t < s
}

const BY_RANK: Horizon[] = ['day', 'week', 'month', 'quarter', 'year', 'life']

/**
 * The horizons a sub-goal chain goes through from `source` down to `target`,
 * one level at a time: year → week = quarter, month, week. A goal never skips
 * a level (no month goal hanging directly off a year goal).
 */
export function horizonsDown(source: Horizon, target: Horizon): Horizon[] {
  const s = RANK[source]
  const t = RANK[target]
  if (s === undefined || t === undefined || t >= s) return []
  return BY_RANK.slice(t, s).reverse()
}

interface DoneNode {
  id: string
  parent_id: string | null
  done_at: string | null
}

/**
 * After `changedId` was checked or unchecked: every ancestor is done exactly
 * when all its sub-goals are done (checking the week checks the month once
 * every week of it is done; unchecking one unchecks the month).
 */
export function propagateDone<T extends DoneNode>(goals: T[], changedId: string, now: string = new Date().toISOString()): T[] {
  const byId = new Map(goals.map((g) => [g.id, g]))
  let parentId = byId.get(changedId)?.parent_id ?? null
  for (let depth = 0; parentId && depth < 10; depth++) {
    const parent = byId.get(parentId)
    if (!parent) break
    const children = goals.filter((g) => g.parent_id === parentId).map((g) => byId.get(g.id)!)
    const allDone = children.length > 0 && children.every((c) => c.done_at)
    const doneAt = allDone ? (parent.done_at ?? now) : null
    if (doneAt === parent.done_at) break
    byId.set(parent.id, { ...parent, done_at: doneAt })
    parentId = parent.parent_id
  }
  return goals.map((g) => byId.get(g.id)!)
}

// ── Moving a goal carries its sub-goals ────────────────────────────────────

interface MovableGoal {
  id: string
  parent_id: string | null
  horizon: Horizon
  period_start: string | null
}

const DAY_MS = 86_400_000
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/** Where a sub-goal goes once its parent moved from `before` to `after`. */
function placeChild(child: MovableGoal, before: MovableGoal, after: MovableGoal, today: string): Pick<MovableGoal, 'horizon' | 'period_start'> {
  if (after.horizon === 'inbox') return { horizon: 'inbox', period_start: null }
  const horizon: Horizon = after.horizon === 'life' ? 'year' : childHorizon(after.horizon as DatedHorizon)
  // Same horizon, other period: keep the child's place inside it (S42's Tuesday → S43's Tuesday).
  let date = child.period_start ?? after.period_start ?? today
  if (child.period_start && before.horizon === after.horizon && before.period_start && after.period_start) {
    date = addDaysISO(child.period_start, dayDiff(before.period_start, after.period_start))
  }
  if (after.period_start && !isUndated(after.horizon)) {
    const end = periodEnd(after.horizon as DatedHorizon, after.period_start)
    if (date < after.period_start) date = after.period_start
    if (date > end) date = end
  }
  return { horizon, period_start: periodStart(horizon as DatedHorizon, date) }
}

/**
 * `id` moves to `target`: its whole subtree follows, each sub-goal one level
 * under its parent (a sub-goal dragged alone moves alone — its parent stays).
 */
export function moveSubtree<T extends MovableGoal>(goals: T[], id: string, target: Pick<MovableGoal, 'horizon' | 'period_start'>, today: string = todayISO()): T[] {
  const byId = new Map(goals.map((g) => [g.id, g]))
  const root = byId.get(id)
  if (!root) return goals
  const moved = new Map<string, T>()
  const visit = (before: T, after: T) => {
    moved.set(after.id, after)
    for (const child of goals.filter((g) => g.parent_id === before.id)) {
      visit(child, { ...child, ...placeChild(child, before, after, today) })
    }
  }
  visit(root, { ...root, ...target })
  return goals.map((g) => moved.get(g.id) ?? g)
}
