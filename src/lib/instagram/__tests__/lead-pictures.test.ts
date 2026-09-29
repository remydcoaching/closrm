import { describe, expect, it } from 'vitest'
import { leadsNeedingPicture, normalizeHandle, profilePatch, type LeadToEnrich } from '../lead-pictures'

const lead = (o: Partial<LeadToEnrich>): LeadToEnrich => ({ id: 'l', instagram_handle: 'bob', instagram_user_id: null, instagram_profile_pic_url: null, instagram_profile_synced_at: null, ...o })
const NOW = Date.parse('2026-09-27T12:00:00Z')

describe('leadsNeedingPicture', () => {
  it('keeps leads with a valid handle and no picture', () => {
    expect(leadsNeedingPicture([lead({})], NOW)).toHaveLength(1)
  })
  it('skips leads with a picture, an invalid handle, or a recent lookup (never paid twice)', () => {
    expect(leadsNeedingPicture([lead({ instagram_profile_pic_url: 'https://x' }), lead({ instagram_handle: 'pas un handle' }), lead({ instagram_profile_synced_at: '2026-09-25T00:00:00Z' })], NOW)).toEqual([])
  })
  it('retries a lookup older than 7 days', () => {
    expect(leadsNeedingPicture([lead({ instagram_profile_synced_at: '2026-09-01T00:00:00Z' })], NOW)).toHaveLength(1)
  })
})

describe('normalizeHandle', () => {
  it('strips @ and lowercases, rejects URLs and spaces', () => {
    expect(normalizeHandle('@Bob.Smith')).toBe('bob.smith')
    expect(normalizeHandle('https://instagram.com/bob')).toBeNull()
    expect(normalizeHandle(null)).toBeNull()
  })
})

describe('profilePatch', () => {
  it('prefers the HD picture and sets the Instagram id only when missing', () => {
    const p = { username: 'bob', pk: 42, profile_pic_url: 'https://s', profile_pic_url_hd: 'https://hd', follower_count: 10 }
    expect(profilePatch(lead({}), p, 'now')).toMatchObject({ instagram_profile_pic_url: 'https://hd', instagram_user_id: '42', instagram_followers_count: 10, instagram_profile_synced_at: 'now' })
    expect(profilePatch(lead({ instagram_user_id: '7' }), p, 'now')).not.toHaveProperty('instagram_user_id')
  })
})
