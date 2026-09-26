// Groups a lead's activity into days for the horizontal "Son parcours"
// strip — one column per day where something happened, with a one-line
// summary ("2 commentaires · 3 j'aime") and the day's gestures.
import type { ActivityEntry } from '../../design-system/ActivityTimeline'

export interface JourneyDay {
  day: string // YYYY-MM-DD (local)
  entries: ActivityEntry[]
  summary: string
}

const KIND_LABEL: Record<string, [string, string]> = {
  comment: ['commentaire', 'commentaires'],
  like: ["j'aime", "j'aime"],
  story_view: ['vue de story', 'vues de story'],
  dm: ['DM', 'DM'],
  mention: ['mention', 'mentions'],
  call: ['appel', 'appels'],
  relance: ['relance', 'relances'],
  funnel: ['action funnel', 'actions funnel'],
}
const ORDER = ['comment', 'dm', 'like', 'story_view', 'mention', 'call', 'relance', 'funnel']

export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function summarize(entries: ActivityEntry[]): string {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.kind ?? 'autre', (counts.get(e.kind ?? 'autre') ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => (ORDER.indexOf(a[0]) + 1 || 99) - (ORDER.indexOf(b[0]) + 1 || 99))
    .map(([kind, n]) => {
      const [one, many] = KIND_LABEL[kind] ?? ['action', 'actions']
      return `${n} ${n > 1 ? many : one}`
    })
    .join(' · ')
}

/** Days with at least one gesture since `sinceIso` (all if null), oldest first. */
export function groupJourneyDays(entries: ActivityEntry[], sinceIso: string | null): JourneyDay[] {
  const byDay = new Map<string, ActivityEntry[]>()
  for (const e of entries) {
    if (sinceIso && e.at < sinceIso) continue
    const day = localDay(e.at)
    byDay.set(day, [...(byDay.get(day) ?? []), e])
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at))
      return { day, entries: sorted, summary: summarize(sorted) }
    })
}
