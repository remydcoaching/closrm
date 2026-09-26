import { describe, expect, it } from 'vitest'
import { interactionKey, planStoryViewRows, storyViewsPayloadSchema, type StoryViewsPayload } from '../story-views'

const NOW = '2026-09-26T10:00:00.000Z'

function payload(viewers: StoryViewsPayload['stories'][number]['viewers']): StoryViewsPayload {
  return {
    accountUsername: 'rebmann_pierre',
    stories: [{ pk: 's1', takenAt: '2026-09-26T08:00:00.000Z', viewers, viewerCount: viewers.length }],
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
