// Period maths for the Goals ("Objectifs") page.
// All dates are plain ISO strings "YYYY-MM-DD" (no time, no timezone) and all
// arithmetic is done in UTC so DST / local timezone can never shift a day.

export type Horizon = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'life' | 'inbox'
export type DatedHorizon = Exclude<Horizon, 'inbox' | 'life'>

export const isUndated = (h: Horizon): h is 'inbox' | 'life' => h === 'inbox' || h === 'life'

export const DATED_HORIZONS: DatedHorizon[] = ['day', 'week', 'month', 'quarter', 'year']

const MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function parseISODate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Invalid ISO date: ${iso}`)
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error(`Invalid ISO date: ${iso}`)
  return d
}

export function toISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today in the user's local timezone, as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

function addMonths(iso: string, n: number): string {
  const d = parseISODate(iso)
  // Only used on first-of-month dates, so no day overflow.
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}

/** ISO-8601 week number and week-year ("S1" is the week containing the 4th of January). */
export function isoWeek(iso: string): { week: number; year: number } {
  const d = parseISODate(iso)
  const dayNum = d.getUTCDay() || 7 // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // Thursday of this week
  const year = d.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return { week, year }
}

/** Normalises any date to the first day of the period that contains it. */
export function periodStart(horizon: DatedHorizon, iso: string): string {
  const d = parseISODate(iso)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  switch (horizon) {
    case 'day':
      return iso
    case 'week':
      return addDays(iso, -((d.getUTCDay() + 6) % 7)) // back to Monday
    case 'month':
      return toISODate(new Date(Date.UTC(y, m, 1)))
    case 'quarter':
      return toISODate(new Date(Date.UTC(y, m - (m % 3), 1)))
    case 'year':
      return toISODate(new Date(Date.UTC(y, 0, 1)))
  }
}

/** Moves a period start by n periods (n can be negative). */
export function addPeriods(horizon: DatedHorizon, start: string, n: number): string {
  switch (horizon) {
    case 'day': return addDays(start, n)
    case 'week': return addDays(start, 7 * n)
    case 'month': return addMonths(start, n)
    case 'quarter': return addMonths(start, 3 * n)
    case 'year': return addMonths(start, 12 * n)
  }
}

/** Last day (inclusive) of the period starting at `start`. */
export function periodEnd(horizon: DatedHorizon, start: string): string {
  return addDays(addPeriods(horizon, start, 1), -1)
}

/** List of period starts from the period containing `from` to the one containing `to` (inclusive). */
export function periodRange(horizon: DatedHorizon, from: string, to: string): string[] {
  const out: string[] = []
  let cur = periodStart(horizon, from)
  const last = periodStart(horizon, to)
  while (cur <= last) {
    out.push(cur)
    cur = addPeriods(horizon, cur, 1)
  }
  return out
}

export function isCurrentPeriod(horizon: DatedHorizon, start: string, today: string = todayISO()): boolean {
  return periodStart(horizon, today) === start
}

/** "12–18 oct.", "26 oct.–1 nov.", "29 déc. 2025–4 janv. 2026" */
export function formatDayRange(from: string, to: string): string {
  const a = parseISODate(from)
  const b = parseISODate(to)
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear()
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth()
  if (sameMonth) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`
  if (sameYear) {
    return `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`
  }
  return `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]} ${a.getUTCFullYear()}–${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`
}

export interface PeriodLabel {
  /** Big column title: "S42, 2026", "Jeudi", "Octobre", "T4 2026", "2026". */
  title: string
  /** Smaller line under it: "12–18 oct.", "15 octobre", "2026", "oct.–déc.", "". */
  subtitle: string
}

export function periodLabel(horizon: DatedHorizon, start: string): PeriodLabel {
  const d = parseISODate(start)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  switch (horizon) {
    case 'day':
      return { title: WEEKDAYS[d.getUTCDay()], subtitle: `${d.getUTCDate()} ${MONTHS_LONG[m]}` }
    case 'week': {
      const { week, year } = isoWeek(start)
      return { title: `S${week}, ${year}`, subtitle: formatDayRange(start, periodEnd('week', start)) }
    }
    case 'month':
      return { title: cap(MONTHS_LONG[m]), subtitle: String(y) }
    case 'quarter':
      return {
        title: `T${Math.floor(m / 3) + 1} ${y}`,
        subtitle: `${MONTHS_SHORT[m]}–${MONTHS_SHORT[m + 2]}`,
      }
    case 'year':
      return { title: String(y), subtitle: '' }
  }
}

/** Short label of a goal's date, shown under a sub-goal ("15 octobre", "S42", "Octobre 2026"…). */
export function shortDateLabel(horizon: Horizon, start: string | null): string {
  if (horizon === 'life') return 'Vie'
  if (horizon === 'inbox' || !start) return 'Inbox'
  const d = parseISODate(start)
  switch (horizon) {
    case 'day': return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`
    case 'week': return `S${isoWeek(start).week} · ${formatDayRange(start, periodEnd('week', start))}`
    case 'month': return `${cap(MONTHS_LONG[d.getUTCMonth()])} ${d.getUTCFullYear()}`
    case 'quarter': return periodLabel('quarter', start).title
    case 'year': return String(d.getUTCFullYear())
  }
}

/** The horizon one level up (shown as the collapsible side column, like Timestripe's "MONTH" tab). */
export function parentHorizon(h: DatedHorizon): DatedHorizon | null {
  const i = DATED_HORIZONS.indexOf(h)
  return i < DATED_HORIZONS.length - 1 ? DATED_HORIZONS[i + 1] : null
}

/** The horizon one level down (where a sub-goal created from a list lands). */
export function childHorizon(h: DatedHorizon): DatedHorizon {
  const i = DATED_HORIZONS.indexOf(h)
  return i > 0 ? DATED_HORIZONS[i - 1] : 'day'
}

/** How many columns to render on each side of "today" before infinite scroll kicks in. */
export const WINDOW_SIZE: Record<DatedHorizon, number> = {
  day: 14, week: 8, month: 6, quarter: 4, year: 3,
}

export type HorizonStarts = Record<DatedHorizon, string>

/** Current period start of every dated horizon (the « Horizons » view on today). */
export function startsAt(date: string): HorizonStarts {
  return {
    day: periodStart('day', date),
    week: periodStart('week', date),
    month: periodStart('month', date),
    quarter: periodStart('quarter', date),
    year: periodStart('year', date),
  }
}

/**
 * Slides one column of the « Horizons » view by n periods. Shorter horizons
 * follow into the new period (today if it falls inside, else its first day);
 * longer horizons realign so they still contain it.
 */
export function cascadeShift(starts: HorizonStarts, horizon: DatedHorizon, n: number, today: string = todayISO()): HorizonStarts {
  const start = addPeriods(horizon, starts[horizon], n)
  const end = periodEnd(horizon, start)
  const focus = today >= start && today <= end ? today : start
  const level = DATED_HORIZONS.indexOf(horizon)
  const next = { ...starts }
  for (const h of DATED_HORIZONS) {
    const i = DATED_HORIZONS.indexOf(h)
    next[h] = i === level ? start : periodStart(h, i < level ? focus : start)
  }
  return next
}
