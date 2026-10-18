// Goals data: one cached list per (horizon, range), optimistic mutations on
// every list on screen, rollback + message on failure.
import { useCallback, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { discardInflight, getCached, invalidate, setCached } from '../../lib/query-cache'
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

export function useGoals(horizon: Horizon | null, from?: string, to?: string) {
  const key = horizon ? goalsKey(horizon, from, to) : null
  return {
    key,
    ...useCachedQuery<GoalsResponse>(key, {
      screen: 'Objectifs',
      staleMs: 15_000,
      keepPrevious: true,
      fetcher: horizon ? () => api.get<GoalsResponse>(goalsUrl(horizon, from, to)) : undefined,
    }),
  }
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
          return done !== undefined || counterDone !== undefined ? propagateDone(moved, id) : moved
        },
        () => api.patch(`/api/goals/${id}`, patch),
      )
    },
    [run],
  )

  const remove = useCallback(
    (id: string) => {
      if (id.startsWith('tmp-')) return Promise.resolve()
      return run(
        (goals) => {
          const gone = withDescendants(goals, id)
          return goals.filter((g) => !gone.has(g.id))
        },
        () => api.delete(`/api/goals/${id}`),
      )
    },
    [run],
  )

  return { create, update, remove, error, clearError: () => setError(null) }
}
