// Goals data: one cached list per (horizon, range), optimistic mutations on
// every list on screen, rollback + message on failure.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { cachedKeys, discardInflight, getCached, invalidate, setCached } from '../../lib/query-cache'
import { useCachedQuery } from '../../lib/use-cached-query'
import { moveSubtree, propagateDone } from './goal-tree'
import { isUndated, type Horizon } from './periods'

export type GoalColor = 'yellow' | 'pink' | 'green' | 'blue' | 'purple' | 'orange'

export interface Goal {
  id: string
  parent_id: string | null
  title: string
  description: string | null
  horizon: Horizon
  period_start: string | null
  position: number
  done_at: string | null
  color: GoalColor | null
  created_at: string
  /** Period it was first planned in, when it was carried over unfinished (migration 129). */
  carried_from?: string | null
  /** Repeats each period of its horizon (migration 130). */
  repeats?: boolean
  series_id?: string | null
  /** Number aimed for per period (« 10 » posts); null = a plain checkbox. */
  target?: number | null
  progress?: number
  /** Day goal placed in the Agenda (migration 131); null = in the day's strip. */
  scheduled_at?: string | null
  duration_minutes?: number | null
  /** Last day a repeating goal still comes back (migration 132); null = no end. */
  repeat_until?: string | null
}

export interface GoalsResponse {
  goals: Goal[]
}

export function goalsKey(horizon: Horizon, from?: string, to?: string): string {
  return isUndated(horizon) ? `goals:${horizon}` : `goals:${horizon}:${from}:${to}`
}

function goalsUrl(horizon: Horizon, from?: string, to?: string): string {
  const p = new URLSearchParams({ horizon })
  if (!isUndated(horizon) && from && to) {
    p.set('from', from)
    p.set('to', to)
  }
  return `/api/goals?${p.toString()}`
}

// ── Delete with « Annuler » ──────────────────────────────────────────────
// A deleted goal (and its sub-goals) is hidden at once; the server delete only
// runs after UNDO_DELAY_MS, so « Annuler » simply shows it again. Module-level:
// leaving the page does not cancel it.
export const UNDO_DELAY_MS = 8000
interface PendingDelete {
  ids: Set<string>
  label: string
  timer: ReturnType<typeof setTimeout>
  commit: () => Promise<void>
}
let pendingDelete: PendingDelete | null = null
const hiddenIds = new Set<string>()
let undoVersion = 0
const undoListeners = new Set<() => void>()
function bumpUndo() {
  undoVersion++
  undoListeners.forEach((fn) => fn())
}
function subscribeUndo(fn: () => void) {
  undoListeners.add(fn)
  return () => {
    undoListeners.delete(fn)
  }
}

/** The delete waiting for « Annuler » (label to show), re-rendering when it changes. */
export function usePendingDelete(): { label: string } | null {
  useSyncExternalStore(subscribeUndo, () => undoVersion)
  return pendingDelete ? { label: pendingDelete.label } : null
}

/** « Annuler »: the goal shows again, nothing is deleted. */
export function undoDelete() {
  if (!pendingDelete) return
  clearTimeout(pendingDelete.timer)
  for (const id of pendingDelete.ids) hiddenIds.delete(id)
  pendingDelete = null
  bumpUndo()
}

/** Runs the waiting delete now (the bar's ×, a new delete, or the delay running out). */
export function flushDelete(): Promise<void> {
  if (!pendingDelete) return Promise.resolve()
  const p = pendingDelete
  pendingDelete = null
  clearTimeout(p.timer)
  bumpUndo()
  return p.commit()
}

export function useGoals(horizon: Horizon | null, from?: string, to?: string) {
  const key = horizon ? goalsKey(horizon, from, to) : null
  const version = useSyncExternalStore(subscribeUndo, () => undoVersion)
  const q = useCachedQuery<GoalsResponse>(key, {
    screen: 'Objectifs',
    staleMs: 15_000,
    keepPrevious: true,
    fetcher: horizon ? () => api.get<GoalsResponse>(goalsUrl(horizon, from, to)) : undefined,
  })
  // Goals waiting for « Annuler » are hidden from every list.
  const data = useMemo(
    () => (q.data && hiddenIds.size ? { goals: q.data.goals.filter((g) => !hiddenIds.has(g.id)) } : q.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, version],
  )
  return { key, ...q, data }
}

/**
 * Like Timestripe's auto-move: unfinished goals of past periods move to the
 * current one, repeating ones get this period's occurrence. Run by every
 * screen that shows goals (Objectifs, Agenda); lists refresh only if something moved.
 */
export function useGoalsRollover(today: string) {
  useEffect(() => {
    api
      .post<{ moved: number }>('/api/goals/rollover', { today })
      .then((r) => {
        if (r.moved > 0) invalidate('goals:')
      })
      .catch(() => undefined)
  }, [today])
}

export interface GoalPatch {
  title?: string
  done?: boolean
  horizon?: Horizon
  period_start?: string | null
  position?: number
  parent_id?: string | null
  color?: GoalColor | null
  repeats?: boolean
  target?: number | null
  progress?: number
  scheduled_at?: string | null
  duration_minutes?: number
  repeat_until?: string | null
}

export interface NewGoal {
  title: string
  horizon: Horizon
  period_start: string | null
  parent_id?: string | null
  position: number
}

/** The goal and all its descendants (deleted together, like the DB cascade). */
function withDescendants(goals: Goal[], id: string): Set<string> {
  const out = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const g of goals) {
      if (g.parent_id && out.has(g.parent_id) && !out.has(g.id)) {
        out.add(g.id)
        grew = true
      }
    }
  }
  return out
}

export function useGoalMutations(keys: (string | null)[]) {
  const [error, setError] = useState<string | null>(null)
  const liveKeys = keys.filter((k): k is string => !!k)
  const keysSig = liveKeys.join('|')

  const run = useCallback(
    async <R>(apply: (goals: Goal[]) => Goal[], call: () => Promise<R>, confirm?: (result: R, goals: Goal[]) => Goal[]): Promise<R | undefined> => {
      const ks = keysSig.split('|').filter(Boolean)
      // A refetch already running would bring back the list without this change.
      discardInflight('goals:')
      const snapshots = ks.map((k) => [k, getCached<GoalsResponse>(k)?.data] as const)
      for (const [k, prev] of snapshots) if (prev) setCached<GoalsResponse>(k, { goals: apply(prev.goals) })
      try {
        const result = await call()
        // Server answer in hand (e.g. the real id of a new goal): apply it now,
        // without waiting for the background refetch.
        if (confirm) {
          for (const k of ks) {
            const cur = getCached<GoalsResponse>(k)?.data
            if (cur) setCached<GoalsResponse>(k, { goals: confirm(result, cur.goals) })
          }
        }
        setError(null)
        return result
      } catch (err) {
        for (const [k, prev] of snapshots) if (prev) setCached(k, prev)
        setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
        return undefined
      } finally {
        invalidate('goals:')
      }
    },
    [keysSig],
  )

  const create = useCallback(
    (input: NewGoal) => {
      const tmp: Goal = {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        parent_id: input.parent_id ?? null,
        title: input.title,
        description: null,
        horizon: input.horizon,
        period_start: input.period_start,
        position: input.position,
        done_at: null,
        color: null,
        created_at: new Date().toISOString(),
      }
      return run(
        (goals) => [...goals, tmp],
        () => api.post<{ goal: Goal }>('/api/goals', input),
        ({ goal }, goals) => goals.map((g) => (g.id === tmp.id ? goal : g)),
      ).then((r) => r?.goal) // the saved goal, or undefined if it failed
    },
    [run],
  )

  const update = useCallback(
    (id: string, patch: GoalPatch) => {
      if (id.startsWith('tmp-')) return Promise.resolve()
      const { done, ...rest } = patch
      return run(
        (goals) => {
          let counterDone: boolean | undefined
          const next = goals.map((g) => {
            if (g.id !== id) return g
            const merged = { ...g, ...rest, ...(done !== undefined ? { done_at: done ? new Date().toISOString() : null } : {}) }
            if (rest.repeats === true && !merged.series_id) merged.series_id = g.id // the server does the same
            // A counter (« 7/10 ») checks itself at its target, like the server does.
            if (done === undefined && (rest.progress !== undefined || rest.target !== undefined) && merged.target) {
              counterDone = (merged.progress ?? 0) >= merged.target
              merged.done_at = counterDone ? (g.done_at ?? new Date().toISOString()) : null
            }
            return merged
          })
          // Moved to another period or horizon: its sub-goals follow.
          const target = next.find((g) => g.id === id)
          const moved =
            target && (rest.horizon !== undefined || rest.period_start !== undefined)
              ? moveSubtree(goals.map((g) => (g.id === id ? { ...g, position: target.position, title: target.title } : g)), id, { horizon: target.horizon, period_start: target.period_start })
              : next
          // Checking a sub-goal can check (or uncheck) its parents.
          // Checking a day slice of a counter goal counts it on the parent (+1 / −1), like the server.
          let counted = moved
          const before = goals.find((g) => g.id === id)
          const parent = before?.parent_id ? moved.find((g) => g.id === before.parent_id) : undefined
          if (done !== undefined && before && !!done !== !!before.done_at && parent?.target) {
            const progress = Math.max(0, (parent.progress ?? 0) + (done ? 1 : -1))
            const done_at = progress >= parent.target ? (parent.done_at ?? new Date().toISOString()) : null
            counted = moved.map((g) => (g.id === parent.id ? { ...g, progress, done_at } : g))
            counted = propagateDone(counted, parent.id)
          }
          return done !== undefined || counterDone !== undefined ? propagateDone(counted, id) : counted
        },
        () => api.patch(`/api/goals/${id}`, patch),
      )
    },
    [run],
  )

  /** Hides the goal and its sub-goals now; the server delete waits for « Annuler » (UNDO_DELAY_MS). */
  const remove = useCallback((id: string, label = 'Objectif supprimé') => {
    if (id.startsWith('tmp-')) return
    void flushDelete() // one pending delete at a time
    const known = new Map<string, Goal>()
    for (const k of cachedKeys('goals:')) for (const g of getCached<GoalsResponse>(k)?.data?.goals ?? []) known.set(g.id, g)
    const ids = withDescendants([...known.values()], id)
    ids.forEach((x) => hiddenIds.add(x))
    pendingDelete = {
      ids,
      label,
      timer: setTimeout(() => void flushDelete(), UNDO_DELAY_MS),
      commit: async () => {
        discardInflight('goals:')
        try {
          await api.delete(`/api/goals/${id}`)
          // Gone on the server: drop it from every cached list before showing them again.
          for (const k of cachedKeys('goals:')) {
            const cur = getCached<GoalsResponse>(k)?.data
            if (cur) setCached<GoalsResponse>(k, { goals: cur.goals.filter((g) => !ids.has(g.id)) })
          }
          setError(null)
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
        } finally {
          ids.forEach((x) => hiddenIds.delete(x))
          bumpUndo()
          invalidate('goals:')
        }
      },
    }
    bumpUndo()
  }, [])

  return { create, update, remove, error, clearError: () => setError(null) }
}
