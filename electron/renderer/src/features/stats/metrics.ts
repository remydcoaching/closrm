// Pure helpers shared by the Stats, Finance and Dashboard pages. Everything
// here is a deterministic transform of rows ALREADY returned by the existing
// ClosRM API — no figure is produced without a source row behind it.

export type StatsPeriod = 0 | 7 | 30 | 90

export interface TimeWindow {
  from: Date
  to: Date
}

const DAY_MS = 86_400_000

/**
 * Rolling windows for a period, identical to the web's getSinceIso():
 * current = [now - N days, now], previous = the N days right before it.
 * Period 0 ("Tout") has no lower bound and therefore no previous window —
 * deltas are never shown for it.
 */
export function periodWindows(period: StatsPeriod, now: Date = new Date()): { current: TimeWindow | null; previous: TimeWindow | null } {
  if (period === 0) return { current: null, previous: null }
  const from = new Date(now.getTime() - period * DAY_MS)
  const prevFrom = new Date(now.getTime() - period * 2 * DAY_MS)
  return { current: { from, to: now }, previous: { from: prevFrom, to: from } }
}

/**
 * % change vs previous period, same rule as the web's pctDelta()
 * (src/lib/dashboard/v2-queries.ts): 0 → 0 is flat, anything → from 0 is
 * not computable (null, never "+∞ %").
 */
export function pctDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

/** Rounded percentage, null when the denominator is 0 (displayed "—"). */
export function ratePct(num: number, den: number): number | null {
  if (den <= 0) return null
  return Math.round((num / den) * 100)
}

/** True when `iso` falls in [from, to). A null window means "no bound". */
export function inWindow(iso: string | null | undefined, w: TimeWindow | null): boolean {
  if (!iso) return false
  if (!w) return true
  const t = new Date(iso).getTime()
  return t >= w.from.getTime() && t < w.to.getTime()
}

/** Local calendar day key "2026-09-25". */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface SeriesPoint {
  key: string
  label: string
  value: number
}

/**
 * Counts per local day between `from` and `to` inclusive, zero-filled so the
 * chart shows real empty days instead of silently skipping them. Switches to
 * monthly buckets when the span exceeds `maxDays` (the "Tout" view).
 */
export function bucketSeries(
  items: { at: string; value?: number }[],
  from: Date,
  to: Date,
  maxDays = 120,
): { granularity: 'day' | 'month'; points: SeriesPoint[] } {
  const spanDays = Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) + 1
  const granularity: 'day' | 'month' = spanDays > maxDays ? 'month' : 'day'
  const keyOf = granularity === 'day' ? dayKey : monthKey
  const counts = new Map<string, number>()
  for (const it of items) {
    const k = keyOf(new Date(it.at))
    counts.set(k, (counts.get(k) ?? 0) + (it.value ?? 1))
  }
  const points: SeriesPoint[] = []
  if (granularity === 'day') {
    const cursor = startOfDay(from)
    const end = startOfDay(to).getTime()
    while (cursor.getTime() <= end) {
      const k = dayKey(cursor)
      points.push({
        key: k,
        label: cursor.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        value: counts.get(k) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1).getTime()
    while (cursor.getTime() <= end) {
      const k = monthKey(cursor)
      points.push({
        key: k,
        label: cursor.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        value: counts.get(k) ?? 0,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }
  return { granularity, points }
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Round axis maximum: 1/2/5 × 10^n — same as the web's MRR chart niceMax(). */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const exp = Math.floor(Math.log10(value))
  const base = Math.pow(10, exp)
  const mantissa = value / base
  const rounded = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10
  return rounded * base
}

export function distinctCount<T>(rows: T[], key: (row: T) => string | null | undefined): number {
  const set = new Set<string>()
  for (const r of rows) {
    const k = key(r)
    if (k) set.add(k)
  }
  return set.size
}

export function sumBy<T>(rows: T[], value: (row: T) => number | null | undefined): number {
  let s = 0
  for (const r of rows) s += Number(value(r) ?? 0) || 0
  return s
}

const EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const EURO_CENTS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatEuro(v: number): string {
  return EURO.format(v)
}

export function formatEuroCents(v: number): string {
  return EURO_CENTS.format(v)
}

/** "YYYY-MM-DD" for endpoints that take plain dates (crm-funnel, reporting, Meta insights). */
export function isoDate(d: Date): string {
  return dayKey(d)
}
