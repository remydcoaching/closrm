// « Quand publier » like Insyder: what the coach's contents got depending on
// when they were published — medians per hour (reels) or per weekday
// (stories), only over hours / days with enough contents to compare. « Vos
// habitudes, pas une loi. » Local time of the computer.
export const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const WEEKDAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

export interface TimedValue {
  at: string
  value: number
}

export interface BucketBest {
  /** Median per bucket (hour 0–23 or weekday 0 = lundi), null when too few contents. */
  medians: (number | null)[]
  counts: number[]
  best: number | null
  bestMedian: number | null
  bestCount: number
  /** Buckets with enough contents to be compared. */
  compared: number
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function bestOf(items: TimedValue[], size: number, keyOf: (d: Date) => number, minSamples: number): BucketBest {
  const groups: number[][] = Array.from({ length: size }, () => [])
  for (const it of items) {
    const d = new Date(it.at)
    if (Number.isNaN(d.getTime())) continue
    groups[keyOf(d)].push(it.value)
  }
  const counts = groups.map((g) => g.length)
  const medians = groups.map((g) => (g.length >= minSamples ? median(g) : null))
  let best: number | null = null
  for (let i = 0; i < size; i++) if (medians[i] !== null && (best === null || (medians[i] as number) > (medians[best] as number))) best = i
  return { medians, counts, best, bestMedian: best === null ? null : medians[best], bestCount: best === null ? 0 : counts[best], compared: medians.filter((m) => m !== null).length }
}

/** Pure: medians per local hour of publication. */
export const bestHour = (items: TimedValue[], minSamples = 2) => bestOf(items, 24, (d) => d.getHours(), minSamples)
/** Pure: medians per weekday of publication (0 = lundi). */
export const bestWeekday = (items: TimedValue[], minSamples = 2) => bestOf(items, 7, (d) => (d.getDay() + 6) % 7, minSamples)
