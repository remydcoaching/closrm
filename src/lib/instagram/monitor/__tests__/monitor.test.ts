import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { estimatedCost, needsCommentsRead, newGestures, observationKey, pickDueContents, remainingBudget, scanIntervalMs, type MonitoredContent, type ObservedGesture } from '../policy'
import { interactionDate, runMonitor } from '../run'
import type { HikerClient } from '@/lib/hiker/client'

const H = 3_600_000
const NOW = Date.parse('2026-09-28T12:00:00Z')
const ago = (h: number) => new Date(NOW - h * H).toISOString()
const content = (o: Partial<MonitoredContent>): MonitoredContent => ({
  content_id: 'c',
  published_at: ago(10),
  next_scan_at: ago(1),
  reported_comment_count: 5,
  comments_read_at_count: 5,
  last_scanned_at: ago(2),
  last_status: 'ok',
  ...o,
})

describe('scanIntervalMs', () => {
  it('re-reads recent publications hourly, older ones less often', () => {
    expect(scanIntervalMs(ago(10), NOW)).toBe(H)
    expect(scanIntervalMs(ago(5 * 24), NOW)).toBe(6 * H)
    expect(scanIntervalMs(ago(30 * 24), NOW)).toBe(24 * H)
    expect(scanIntervalMs(ago(200 * 24), NOW)).toBe(7 * 24 * H)
  })
})

describe('comments are re-read only when needed (the costly part)', () => {
  it('skips comments when the counter did not move', () => {
    expect(needsCommentsRead(content({}))).toBe(false)
    expect(estimatedCost(content({}))).toBe(1)
  })
  it('reads comments when the counter moved, never read, or last read failed', () => {
    expect(needsCommentsRead(content({ reported_comment_count: 9 }))).toBe(true)
    expect(needsCommentsRead(content({ comments_read_at_count: null }))).toBe(true)
    expect(needsCommentsRead(content({ last_status: 'error' }))).toBe(true)
    expect(estimatedCost(content({ reported_comment_count: 65, comments_read_at_count: 5 }))).toBe(1 + 3)
  })
})

describe('pickDueContents', () => {
  it('only due, never deleted, most overdue first, within budget', () => {
    const list = [
      content({ content_id: 'late', next_scan_at: ago(5) }),
      content({ content_id: 'soon', next_scan_at: ago(1) }),
      content({ content_id: 'future', next_scan_at: new Date(NOW + H).toISOString() }),
      content({ content_id: 'gone', last_status: 'not_found', next_scan_at: ago(9) }),
      content({ content_id: 'costly', next_scan_at: ago(3), reported_comment_count: 500, comments_read_at_count: 0 }),
    ]
    expect(pickDueContents(list, NOW, 100).map((c) => c.content_id)).toEqual(['late', 'costly', 'soon'])
    // budget 2: 'late' (1) fits, 'costly' (6) doesn't, 'soon' (1) fits
    expect(pickDueContents(list, NOW, 2).map((c) => c.content_id)).toEqual(['late', 'soon'])
  })
})

describe('newGestures', () => {
  const g = (o: Partial<ObservedGesture>): ObservedGesture => ({ contentId: 'c', type: 'like', instagramUserId: '1', username: 'a', fullName: null, profilePicUrl: null, dedupKey: '', commentText: null, commentedAt: null, ...o })
  it('keeps only what was not seen before, keyed by Instagram id (a renamed user is the same person)', () => {
    const known = new Set([observationKey(g({}))])
    const out = newGestures([g({ username: 'renamed' }), g({ instagramUserId: '2' }), g({ instagramUserId: '2' }), g({ type: 'comment', dedupKey: 'k1' }), g({ type: 'comment', dedupKey: 'k2' })], known)
    expect(out.map((x) => `${x.instagramUserId}:${x.type}:${x.dedupKey}`)).toEqual(['2:like:', '1:comment:k1', '1:comment:k2'])
  })
  it('dates: comment = Instagram date; like on first pass = publication (lower bound); later = observation', () => {
    expect(interactionDate(g({ type: 'comment', commentedAt: '2026-09-27T08:00:00Z' }), null, ago(48), 'now')).toBe('2026-09-27T08:00:00Z')
    expect(interactionDate(g({}), null, '2026-09-20T00:00:00Z', 'now')).toBe('2026-09-20T00:00:00Z')
    expect(interactionDate(g({}), ago(1), '2026-09-20T00:00:00Z', 'now')).toBe('now')
  })
})

describe('remainingBudget', () => {
  it('never negative', () => {
    expect(remainingBudget(300, 120)).toBe(180)
    expect(remainingBudget(300, 400)).toBe(0)
  })
})

// Minimal fake: answers the settings / runs reads of runMonitor's guards.
function fakeSupabase(settings: Record<string, unknown> | null, usedToday: number) {
  const inserts: string[] = []
  const q = (table: string) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      select: self,
      eq: self,
      gte: () => Promise.resolve({ data: table === 'instagram_monitor_runs' ? [{ requests: usedToday }] : [], error: null }),
      maybeSingle: () => Promise.resolve({ data: table === 'instagram_monitor_settings' ? settings : null, error: null }),
      insert: () => {
        inserts.push(table)
        return chain
      },
    })
    return chain
  }
  return { client: { from: q } as unknown as SupabaseClient, inserts }
}

describe('runMonitor guards (never spends when it must not)', () => {
  const makeClient = vi.fn(() => ({}) as HikerClient)
  it('cron + disabled → skipped, no Hiker client, no run row', async () => {
    const { client, inserts } = fakeSupabase({ enabled: false, max_requests_per_day: 300 }, 0)
    expect((await runMonitor(client, 'ws', makeClient, 'cron')).status).toBe('SKIPPED')
    expect(makeClient).not.toHaveBeenCalled()
    expect(inserts).toEqual([])
  })
  it('daily budget used up → skipped', async () => {
    const { client } = fakeSupabase({ enabled: true, max_requests_per_day: 300, instagram_username: 'me' }, 299)
    expect(await runMonitor(client, 'ws', makeClient, 'manual')).toMatchObject({ status: 'SKIPPED', reason: 'budget' })
    expect(makeClient).not.toHaveBeenCalled()
  })
})
