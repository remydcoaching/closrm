// Rules between a goal and its sub-goals.
import type { Horizon } from './periods'

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
