// "Quand publier" — average Instagram engagement rate of the coach's own
// contents by weekday and time slot of publication (local time). Built only
// from scanned contents that have views (see content-metrics.ts); a cell
// with fewer than MIN_SAMPLES contents is shown but flagged as not
// significant rather than ranked.
export const SLOTS = [
  { key: 'matin', label: '6h–12h', from: 6, to: 12 },
  { key: 'aprem', label: '12h–18h', from: 12, to: 18 },
  { key: 'soir', label: '18h–23h', from: 18, to: 23 },
  { key: 'nuit', label: '23h–6h', from: 23, to: 6 },
] as const

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const MIN_SAMPLES = 2

export interface TimingCell {
  weekday: number // 0 = lundi
  slot: number // index in SLOTS
  count: number
  avgRate: number | null
}

export function slotOf(hour: number): number {
  if (hour >= 6 && hour < 12) return 0
  if (hour >= 12 && hour < 18) return 1
  if (hour >= 18 && hour < 23) return 2
  return 3
}

export function publishTiming(contents: { publishedAt: string | null; engagementRate: number | null }[]): TimingCell[] {
  const sums = new Map<string, { total: number; count: number }>()
  for (const c of contents) {
    if (!c.publishedAt || c.engagementRate === null) continue
    const d = new Date(c.publishedAt)
    const weekday = (d.getDay() + 6) % 7
    const key = `${weekday}|${slotOf(d.getHours())}`
    const s = sums.get(key) ?? { total: 0, count: 0 }
    s.total += c.engagementRate
    s.count += 1
    sums.set(key, s)
  }
  const cells: TimingCell[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let slot = 0; slot < SLOTS.length; slot++) {
      const s = sums.get(`${weekday}|${slot}`)
      cells.push({ weekday, slot, count: s?.count ?? 0, avgRate: s ? s.total / s.count : null })
    }
  }
  return cells
}

/** Best significant cells, highest average rate first. */
export function bestSlots(cells: TimingCell[], n = 3): TimingCell[] {
  return cells
    .filter((c) => c.avgRate !== null && c.count >= MIN_SAMPLES)
    .sort((a, b) => (b.avgRate as number) - (a.avgRate as number))
    .slice(0, n)
}
