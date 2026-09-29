import { describe, expect, it } from 'vitest'
import { effectiveState, finalStoryPks, storiesToRecheck, storyViewerNote, viewersOfStories, type HighlightViewer } from '../story-scan'

describe('finalStoryPks', () => {
  it('skips only stories read successfully after their 48 h window', () => {
    expect(
      finalStoryPks([
        { story_pk: 'final', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 3, fetch_status: 'ok' },
        { story_pk: 'still-open', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-01T12:00:00Z', viewers_collected: 3, fetch_status: 'ok' },
        { story_pk: 'failed', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 0, fetch_status: 'error' },
        { story_pk: 'legacy', taken_at: '2026-09-01T00:00:00Z', last_collected_at: '2026-09-05T00:00:00Z', viewers_collected: 0 },
      ]),
    ).toEqual(['final', 'legacy'])
  })
})


describe('storiesToRecheck (48 h window)', () => {
  const H = 3_600_000
  const now = Date.parse('2026-09-27T12:00:00Z')
  const k = (pk: string, takenHoursAgo: number, readHoursAgo: number, fetch_status: 'ok' | 'error' = 'ok') => ({
    story_pk: pk,
    taken_at: new Date(now - takenHoursAgo * H).toISOString(),
    last_collected_at: new Date(now - readHoursAgo * H).toISOString(),
    viewers_collected: 10,
    fetch_status,
  })
  it('re-reads expired stories still inside the window every 2 h', () => {
    expect(storiesToRecheck([k('a', 30, 3), k('b', 30, 1)], now).map((s) => s.pk)).toEqual(['a'])
  })
  it('never re-reads a story past 48 h', () => {
    expect(storiesToRecheck([k('old', 49, 20)], now)).toEqual([])
  })
  it('does one final read after 44 h even if the last read is recent', () => {
    expect(storiesToRecheck([k('f', 45, 1.5)], now).map((s) => s.pk)).toEqual(['f'])
  })
  it('retries a failed read right away', () => {
    expect(storiesToRecheck([k('e', 30, 0.2, 'error')], now).map((s) => s.pk)).toEqual(['e'])
  })
})

describe('highlight story states', () => {
  const now = Date.parse('2026-09-27T12:00:00Z')
  it('an old story ClosRM never stored is out of Instagram window, a fresh one is pending', () => {
    expect(effectiveState(undefined, '2026-01-01T00:00:00Z', now)).toBe('out_of_window')
    expect(effectiveState('unknown', '2026-09-27T00:00:00Z', now)).toBe('unknown')
    expect(effectiveState('error', '2026-01-01T00:00:00Z', now)).toBe('error')
  })
  it('never labels an unavailable list as 0 viewers', () => {
    expect(storyViewerNote('out_of_window', 0)).not.toMatch(/\b0\b/)
    expect(storyViewerNote('error', null)).not.toMatch(/\b0\b/)
    expect(storyViewerNote('collected', 0)).toBe('0 spectateur identifié')
    expect(storyViewerNote('collected', 3)).toBe('3 spectateurs identifiés')
  })
  it('viewersOfStories recounts per collection', () => {
    const v = (id: string, pks: string[]): HighlightViewer => ({ instagramUserId: id, username: id, fullName: null, profilePicUrl: null, leadId: null, leadName: null, storiesSeen: pks.length, storyPks: pks, liked: 0, lastObservedAt: '2026-09-20T00:00:00Z' })
    const out = viewersOfStories([v('1', ['a', 'x']), v('2', ['a', 'b']), v('3', ['x'])], ['a', 'b'])
    expect(out.map((o) => [o.instagramUserId, o.storiesSeen])).toEqual([['2', 2], ['1', 1]])
  })
})

describe('storiesToRecheck date format', () => {
  it('hands over canonical ISO dates even when Postgres answers with an offset', () => {
    const now = Date.parse('2026-09-27T12:00:00Z')
    const out = storiesToRecheck([{ story_pk: 'a', taken_at: '2026-09-26T08:00:00+00:00', last_collected_at: '2026-09-26T20:00:00+00:00', viewers_collected: 3, fetch_status: 'ok' }], now)
    expect(out).toEqual([{ pk: 'a', takenAt: '2026-09-26T08:00:00.000Z' }])
  })
})
