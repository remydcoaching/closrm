import { describe, expect, it } from 'vitest'
import { interactionKey, planStoryViewRows, storyViewsPayloadSchema, type StoryViewsPayload } from '../story-views'

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
