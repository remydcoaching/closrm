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
