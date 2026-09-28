import { describe, expect, it } from 'vitest'
import { interactionKey, planLeadEnrichment, planStoryViewRows, storyViewsPayloadSchema, type StoryViewsPayload } from '../story-views'

const NOW = '2026-09-26T10:00:00.000Z'

function payload(viewers: StoryViewsPayload['stories'][number]['viewers']): StoryViewsPayload {
  return {
    accountUsername: 'rebmann_pierre',
    stories: [{ pk: 's1', takenAt: '2026-09-26T08:00:00.000Z', viewers, viewerCount: viewers.length, status: 'ok' }],
  }
}

describe('storyViewsPayloadSchema', () => {
  it('accepts a well-formed payload and rejects a bad date', () => {
    expect(storyViewsPayloadSchema.safeParse(payload([{ pk: '1', username: 'a' }])).success).toBe(true)
    expect(storyViewsPayloadSchema.safeParse({ accountUsername: 'x', stories: [{ pk: 's', takenAt: 'hier', viewers: [] }] }).success).toBe(false)
  })
})

describe('planStoryViewRows', () => {
  const leads = { byUserId: new Map([['1', 'lead-a']]), byHandle: new Map([['bob', 'lead-b']]) }

  it('writes one viewer row per unique viewer and matches leads by id then handle', () => {
    const rows = planStoryViewRows('ws', payload([{ pk: '1', username: 'alice' }, { pk: '2', username: 'Bob' }, { pk: '3', username: 'carl' }, { pk: '1', username: 'alice' }]), leads, new Set(), NOW)
    expect(rows.viewers).toHaveLength(3)
    expect(rows.viewers.map((v) => v.matched_lead_id)).toEqual(['lead-a', 'lead-b', null])
    expect(rows.stories[0]).toMatchObject({ story_pk: 's1', viewers_collected: 3, instagram_account_username: 'rebmann_pierre' })
  })

  it('creates a story_view interaction only for leads, and only once', () => {
    const existing = new Set([interactionKey('lead-a', 's1', '1')])
    const rows = planStoryViewRows('ws', payload([{ pk: '1', username: 'alice' }, { pk: '2', username: 'bob' }, { pk: '3', username: 'carl' }]), leads, existing, NOW)
    expect(rows.interactions).toHaveLength(1)
    expect(rows.interactions[0]).toMatchObject({ lead_id: 'lead-b', interaction_type: 'story_view', source_post_id: 's1', last_seen_at: NOW })
  })
})

describe('highlight story viewers', () => {
  const leads = { byUserId: new Map([['1', 'lead-a']]), byHandle: new Map([['renamed', 'lead-x']]) }
  const hl = (pk: string, viewers: StoryViewsPayload['stories'][number]['viewers'], status: 'ok' | 'error' = 'ok') => ({
    pk,
    takenAt: '2026-08-01T10:00:00.000Z',
    highlightId: 'highlight:9',
    highlightTitle: 'Transformation',
    status,
    viewers,
  })

  it('distinguishes an unreadable list from a readable list with 0 viewers', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [hl('a', [], 'ok'), hl('b', [{ pk: '1', username: 'x' }], 'error')] }, leads, new Set(), NOW)
    expect(rows.stories.find((r) => r.story_pk === 'a')).toMatchObject({ fetch_status: 'ok', viewers_collected: 0 })
    expect(rows.stories.find((r) => r.story_pk === 'b')).toMatchObject({ fetch_status: 'error' })
    expect(rows.viewers).toHaveLength(0) // nothing written from an unreadable list
  })

  it('one person on two stories = one lead, two observations', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [hl('a', [{ pk: '1', username: 'alice' }]), hl('b', [{ pk: '1', username: 'alice' }])] }, leads, new Set(), NOW)
    expect(new Set(rows.viewers.map((v) => v.matched_lead_id))).toEqual(new Set(['lead-a']))
    expect(rows.interactions.map((i) => i.source_post_id)).toEqual(['a', 'b'])
  })

  it('matches by Instagram user id before username (usernames change)', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [hl('a', [{ pk: '1', username: 'renamed' }])] }, leads, new Set(), NOW)
    expect(rows.viewers[0].matched_lead_id).toBe('lead-a')
  })

  it('records observation time, never a guessed view time, and the highlight', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [hl('a', [{ pk: '1', username: 'alice', isPrivate: true }])] }, leads, new Set(), NOW)
    expect(rows.interactions[0]).toMatchObject({ first_seen_at: NOW, last_seen_at: NOW, metadata: { highlight_id: 'highlight:9', highlight_title: 'Transformation', story_taken_at: '2026-08-01T10:00:00.000Z' } })
    expect(rows.viewers[0]).toMatchObject({ is_private: true })
    expect(rows.stories[0]).toMatchObject({ highlight_title: 'Transformation' })
  })

  it('scopes every row to the calling workspace', () => {
    const rows = planStoryViewRows('ws-B', { accountUsername: 'me', stories: [hl('a', [{ pk: '1', username: 'alice' }])] }, leads, new Set(), NOW)
    for (const r of [...rows.stories, ...rows.viewers, ...rows.interactions]) expect(r.workspace_id).toBe('ws-B')
  })
})

import { vi } from 'vitest'
import { persistStoryViews } from '../story-views'

describe('persistStoryViews with a missing optional column', () => {
  it('keeps has_liked when only is_private is missing (regression)', async () => {
    const viewerWrites: Record<string, unknown>[][] = []
    const table = (name: string) => {
      const q: Record<string, unknown> = {}
      const chain = () => q
      Object.assign(q, {
        select: chain,
        eq: chain,
        in: () => Promise.resolve({ data: [], error: null }),
        upsert: (rows: Record<string, unknown>[]) => {
          if (name !== 'story_viewers') return Promise.resolve({ error: null })
          viewerWrites.push(rows)
          const bad = rows[0] && 'is_private' in rows[0]
          return Promise.resolve({ error: bad ? { message: "Could not find the 'is_private' column" } : null })
        },
        insert: () => Promise.resolve({ error: null }),
      })
      return q
    }
    const supabase = { from: vi.fn(table) }
    await persistStoryViews(supabase as never, 'ws', {
      accountUsername: 'me',
      stories: [{ pk: '1', takenAt: '2026-09-26T08:00:00.000Z', status: 'ok', viewers: [{ pk: '9', username: 'fan', hasLiked: true, isPrivate: false }] }],
    })
    const last = viewerWrites[viewerWrites.length - 1][0]
    expect(last).not.toHaveProperty('is_private')
    expect(last).toMatchObject({ has_liked: true })
  })
})

describe('re-reads never erase stored data', () => {
  it('a re-read expired story (no media, no highlight) omits those columns instead of nulling them', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [{ pk: 's9', takenAt: '2026-09-26T08:00:00.000Z', status: 'ok', viewers: [{ pk: '1', username: 'a' }] }] }, { byUserId: new Map(), byHandle: new Map() }, new Set(), NOW)
    const st = rows.stories[0]
    for (const k of ['thumbnail_url', 'media_type', 'expiring_at', 'viewer_count', 'highlight_id', 'highlight_title', 'like_count']) expect(st).not.toHaveProperty(k)
    expect(st).toMatchObject({ viewers_collected: 1, fetch_status: 'ok' })
  })
  it('an explicit null is still written (the client said "none")', () => {
    const rows = planStoryViewRows('ws', { accountUsername: 'me', stories: [{ pk: 's9', takenAt: '2026-09-26T08:00:00.000Z', thumbnailUrl: null, status: 'ok', viewers: [] }] }, { byUserId: new Map(), byHandle: new Map() }, new Set(), NOW)
    expect(rows.stories[0]).toHaveProperty('thumbnail_url', null)
  })
})

describe('planLeadEnrichment', () => {
  const pay = (viewers: StoryViewsPayload['stories'][number]['viewers'], status: 'ok' | 'error' = 'ok'): StoryViewsPayload => ({
    accountUsername: 'me',
    stories: [{ pk: 's1', takenAt: '2026-09-26T08:00:00.000Z', status, viewers }],
  })
  const pic = 'https://scontent.cdninstagram.com/p.jpg'

  it('gives a handle-matched lead its Instagram id and picture', () => {
    const out = planLeadEnrichment(pay([{ pk: '42', username: 'Bob', profilePicUrl: pic }]), { byUserId: new Map(), byHandle: new Map([['bob', 'lead-b']]) }, new Map([['lead-b', { userId: null, picUrl: null }]]))
    expect(out).toEqual([{ leadId: 'lead-b', patch: { instagram_user_id: '42', instagram_profile_pic_url: pic } }])
  })
  it('writes nothing when the lead is already up to date', () => {
    const out = planLeadEnrichment(pay([{ pk: '42', username: 'bob', profilePicUrl: pic }]), { byUserId: new Map([['42', 'lead-b']]), byHandle: new Map() }, new Map([['lead-b', { userId: '42', picUrl: pic }]]))
    expect(out).toEqual([])
  })
  it('ignores unreadable lists and viewers who are not leads', () => {
    expect(planLeadEnrichment(pay([{ pk: '42', username: 'bob', profilePicUrl: pic }], 'error'), { byUserId: new Map([['42', 'l']]), byHandle: new Map() }, new Map([['l', { userId: null, picUrl: null }]]))).toEqual([])
    expect(planLeadEnrichment(pay([{ pk: '7', username: 'x', profilePicUrl: pic }]), { byUserId: new Map(), byHandle: new Map() }, new Map())).toEqual([])
  })
})

describe('dates as Postgres returns them', () => {
  it('accepts "+00:00" offsets (re-read stories come from the database)', () => {
    const p = { accountUsername: 'me', stories: [{ pk: '1', takenAt: '2026-09-26T18:55:00+00:00', status: 'ok', viewers: [] }] }
    expect(storyViewsPayloadSchema.safeParse(p).success).toBe(true)
  })
})
