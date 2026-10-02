import { describe, expect, it } from 'vitest'
import { buildPeople, isBuyerLurker, peopleKpis, type PersonGestureRow } from '../people'
import { DEFAULT_SCORING } from '@/lib/leads/engagement-score'

const NOW = new Date('2026-10-01T12:00:00Z')
const day = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const g = (o: Partial<PersonGestureRow>): PersonGestureRow => ({ username: 'a', kind: 'like', sourceId: 'r1', source: 'reel', at: day(1), ...o })
const opts = (o: Partial<Parameters<typeof buildPeople>[3]> = {}) => ({ recentStoryIds: new Set(['s1', 's2', 's3', 's4']), contacted: new Set<string>(), leads: new Map(), now: NOW, ...o })

describe('Leads Instagram', () => {
  it('one row per account, scored with the CRM weights, first gesture and its source', () => {
    const rows = buildPeople(
      [g({ kind: 'story_view', sourceId: 's1', source: 'story', at: day(20) }), g({ kind: 'comment', sourceId: 'r2', at: day(2) }), g({ username: 'b' })],
      new Map(),
      { ...DEFAULT_SCORING },
      opts(),
    )
    const a = rows.find((r) => r.username === 'a')
    expect(a).toMatchObject({ interactions: 2, storyViews: 1, comments: 1, firstSource: 'story', firstAt: day(20), lastAt: day(2), recentStoriesSeen: 1 })
    expect(a?.score).toBeGreaterThan(rows.find((r) => r.username === 'b')?.score ?? 0)
  })

  it('buyer lurker: half of the recent stories or more, never liked/commented, never contacted', () => {
    const base = { recentStoriesSeen: 2, likes: 0, comments: 0, storyLikes: 0, contacted: false }
    expect(isBuyerLurker(base, 4)).toBe(true)
    expect(isBuyerLurker({ ...base, recentStoriesSeen: 1 }, 4)).toBe(false)
    expect(isBuyerLurker({ ...base, likes: 1 }, 4)).toBe(false)
    expect(isBuyerLurker({ ...base, contacted: true }, 4)).toBe(false)
    expect(isBuyerLurker(base, 0)).toBe(false)
  })

  it('kpis: active vs previous period, very high never contacted, became very high', () => {
    const gestures: PersonGestureRow[] = []
    // « fan »: lots of recent gestures on many contents → très élevé, became so in the period.
    for (let i = 0; i < 40; i++) gestures.push(g({ username: 'fan', kind: 'comment', sourceId: `r${i}`, at: day(1 + (i % 5)) }))
    gestures.push(g({ username: 'old', at: day(45) }))
    const rows = buildPeople(gestures, new Map(), { ...DEFAULT_SCORING }, opts())
    const k = peopleKpis(rows, gestures, 30, 4, { ...DEFAULT_SCORING }, NOW)
    expect(k.active).toBe(1)
    expect(k.activePrevious).toBe(1)
    expect(rows.find((r) => r.username === 'fan')?.confidence).toBe('tres_eleve')
    expect(k.veryHighNeverContacted).toBe(1)
    expect(k.becameVeryHigh).toBe(1)
  })
})
