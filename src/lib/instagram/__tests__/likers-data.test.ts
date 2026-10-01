import { describe, expect, it } from 'vitest'
import { aggregateLikers, type LikeObservation } from '../likers-data'

const obs = (o: Partial<LikeObservation>): LikeObservation => ({
  instagram_user_id: '1',
  instagram_username: 'anna',
  full_name: 'Anna',
  profile_pic_url: null,
  content_id: 'r1',
  first_observed_at: '2026-09-01T00:00:00Z',
  matched_lead_id: null,
  ...o,
})

describe('aggregateLikers', () => {
  it('one row per Instagram account, distinct reels counted, most likes first', () => {
    const rows = aggregateLikers([
      obs({ content_id: 'r1' }),
      obs({ content_id: 'r2' }),
      obs({ content_id: 'r2' }), // same reel twice → 1
      obs({ instagram_user_id: '2', instagram_username: 'bob', content_id: 'r1' }),
    ])
    expect(rows.map((r) => [r.username, r.likes])).toEqual([
      ['anna', 2],
      ['bob', 1],
    ])
  })
  it('a renamed account stays one person; the latest name and picture win', () => {
    const [row] = aggregateLikers([
      obs({ instagram_username: 'old_name', profile_pic_url: 'a.jpg', first_observed_at: '2026-09-01T00:00:00Z' }),
      obs({ instagram_username: 'new_name', profile_pic_url: 'b.jpg', content_id: 'r2', first_observed_at: '2026-09-20T00:00:00Z' }),
    ])
    expect(row).toMatchObject({ username: 'new_name', profilePicUrl: 'b.jpg', likes: 2, lastSeenAt: '2026-09-20T00:00:00Z' })
  })
  it('keeps the lead matched when any like was read; ties broken by most recent', () => {
    const rows = aggregateLikers([
      obs({ instagram_user_id: 'x', matched_lead_id: 'lead-1' }),
      obs({ instagram_user_id: 'x', content_id: 'r2' }),
      obs({ instagram_user_id: 'y', content_id: 'r3', first_observed_at: '2026-09-02T00:00:00Z' }),
      obs({ instagram_user_id: 'y', content_id: 'r4', first_observed_at: '2026-09-02T00:00:00Z' }),
    ])
    expect(rows.find((r) => r.instagramUserId === 'x')?.leadId).toBe('lead-1')
    expect(rows[0].instagramUserId).toBe('y')
  })
})
