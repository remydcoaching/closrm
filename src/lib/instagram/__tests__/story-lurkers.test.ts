import { describe, expect, it } from 'vitest'
import { summarizeViewers, type LeadContact, type StoryRow, type ViewerRow } from '../story-lurkers'

const stories: StoryRow[] = [
  { story_pk: 's1', taken_at: '2026-09-20T10:00:00Z', thumbnail_url: null, viewer_count: 3, viewers_collected: 3 },
  { story_pk: 's2', taken_at: '2026-09-22T10:00:00Z', thumbnail_url: null, viewer_count: 2, viewers_collected: 2 },
]

function viewer(story_pk: string, id: string, lead: string | null = null): ViewerRow {
  return { story_pk, instagram_user_id: id, instagram_username: `u${id}`, full_name: null, profile_pic_url: null, is_verified: null, matched_lead_id: lead }
}

const lead = (id: string, calls: number): LeadContact => ({
  id,
  status: 'nouveau',
  first_name: 'A',
  last_name: 'B',
  call_attempts: calls,
  dm_conversation_active_at: null,
  dmSent: false,
})

describe('summarizeViewers', () => {
  it('counts stories viewed per profile (assiduité) and keeps the latest view', () => {
    const { viewers } = summarizeViewers(stories, [viewer('s1', '1'), viewer('s2', '1'), viewer('s1', '2')], new Map(), new Map())
    expect(viewers[0]).toMatchObject({ userId: '1', views: 2, lastViewedAt: '2026-09-22T10:00:00Z' })
    expect(viewers[1]).toMatchObject({ userId: '2', views: 1 })
  })

  it('counts as lurker every viewer nobody contacted, leads included', () => {
    const leads = new Map([
      ['lead-called', lead('lead-called', 2)],
      ['lead-silent', lead('lead-silent', 0)],
    ])
    const { lurkers, viewers } = summarizeViewers(
      stories,
      [viewer('s1', '1', 'lead-called'), viewer('s1', '2', 'lead-silent'), viewer('s1', '3')],
      leads,
      new Map([['3', false]]),
    )
    expect(lurkers).toBe(2)
    expect(viewers.find((v) => v.userId === '1')?.contacted).toBe(true)
    expect(viewers.find((v) => v.userId === '3')?.followsTarget).toBe(false)
  })

  it('ignores viewers of stories outside the window', () => {
    const { viewers } = summarizeViewers(stories, [viewer('old', '9')], new Map(), new Map())
    expect(viewers).toHaveLength(0)
  })
})
