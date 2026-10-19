// Server-side copy of the desktop's periodStart(): normalises a date to the
// first day of its period so the goals_period_aligned constraint always holds.
export function normalizePeriodStart(horizon: string, iso: string | null | undefined): string | null {
  if (horizon === 'inbox' || horizon === 'life' || !iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  switch (horizon) {
    case 'week':
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
      break
    case 'month':
      date.setUTCDate(1)
      break
    case 'quarter':
      date.setUTCMonth(date.getUTCMonth() - (date.getUTCMonth() % 3), 1)
      break
    case 'year':
      date.setUTCMonth(0, 1)
      break
  }
  return date.toISOString().slice(0, 10)
}

export const ROLLING_HORIZONS = ['day', 'week', 'month', 'quarter', 'year'] as const

const LEVEL: Record<string, number> = { day: 0, week: 1, month: 2, quarter: 3, year: 4, life: 5 }

/** A sub-goal sits exactly one level under its parent (no month goal hanging off a year goal). The Inbox is free. */
export function isDirectChildHorizon(parentHorizon: string, childHorizon: string): boolean {
  const p = LEVEL[parentHorizon]
  const c = LEVEL[childHorizon]
  if (p === undefined || c === undefined) return true
  return p === c + 1 || (p === 0 && c === 0)
}
