import { describe, expect, it } from 'vitest'
import { groupJourneyDays, localDay, summarize } from '../journey-days'
import type { ActivityEntry } from '../../../design-system/ActivityTimeline'

const at = (d: number, h: number) => new Date(2026, 5, d, h).toISOString()
const e = (id: string, iso: string, kind: string): ActivityEntry => ({ id, at: iso, kind, title: id, icon: null })

describe('summarize', () => {
  it('orders comments first and pluralises', () => {
    expect(summarize([e('a', at(18, 9), 'like'), e('b', at(18, 10), 'comment'), e('c', at(18, 11), 'comment'), e('d', at(18, 12), 'like'), e('f', at(18, 13), 'like')])).toBe(
      "2 commentaires · 3 j'aime",
    )
    expect(summarize([e('a', at(18, 9), 'story_view')])).toBe('1 vue de story')
  })
})

describe('groupJourneyDays', () => {
  it('groups by local day, oldest first, and filters by date', () => {
    const entries = [e('late', at(19, 20), 'like'), e('early', at(9, 8), 'comment'), e('mid', at(19, 7), 'like')]
    const days = groupJourneyDays(entries, null)
    expect(days.map((d) => d.day)).toEqual([localDay(at(9, 8)), localDay(at(19, 7))])
    expect(days[1].entries.map((x) => x.id)).toEqual(['mid', 'late'])
    expect(groupJourneyDays(entries, at(10, 0))).toHaveLength(1)
  })
})
