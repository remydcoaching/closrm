import { describe, it, expect } from 'vitest'
import { normalizeUser, normalizeContent, dedupeContents } from '../normalizer'
import { fixtureLiker, makeMediaItem } from './fixtures/responses'

describe('normalizeUser', () => {
  it('extracts instagramUserId from pk when present', () => {
    const result = normalizeUser(fixtureLiker)
    expect(result.instagramUserId).toBe('2000000001')
    expect(result.username).toBe('liker_one')
  })

  it('falls back to null instagramUserId when neither pk nor id is present', () => {
    const result = normalizeUser({ username: 'no_id_user' })
    expect(result.instagramUserId).toBeNull()
  })

  it('falls back to profile_pic_url_hd when profile_pic_url is absent', () => {
    const result = normalizeUser({ username: 'x', pk: 1, profile_pic_url_hd: 'https://hd.example.com/pic.jpg' })
    expect(result.profilePicUrl).toBe('https://hd.example.com/pic.jpg')
  })
})

describe('normalizeContent', () => {
  it('normalizes a media item and marks likeCount as non-authoritative', () => {
    const item = makeMediaItem()
    const result = normalizeContent(item, 'media', 'owner_user')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('5000000001')
    expect(result?.shortcode).toBe('AbCdEfGhIj')
    expect(result?.likeCountReliable).toBe(false)
    expect(result?.url).toBe('https://www.instagram.com/p/AbCdEfGhIj/')
  })

  it('builds a reel URL for clip-type content', () => {
    const item = makeMediaItem({ code: 'ReelCode1' })
    const result = normalizeContent(item, 'clip', 'owner_user')
    expect(result?.url).toBe('https://www.instagram.com/reel/ReelCode1/')
  })

  it('sets timestamp from a valid taken_at unix timestamp', () => {
    const item = makeMediaItem({ taken_at: 1_700_000_000 })
    const result = normalizeContent(item, 'media', 'owner_user')
    expect(result?.timestamp).toBe(new Date(1_700_000_000 * 1000).toISOString())
  })

  it('regression: does not throw when taken_at is present but not a valid time (was RangeError: Invalid time value)', () => {
    // Reproduces the real production crash from a Hiker discovery run:
    // POST /api/instagram/discovery returned 500 "Invalid time value" after
    // ~41s of real, billed Hiker requests, because a truthy check on the
    // raw field let an unparseable value reach new Date(...).toISOString().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = makeMediaItem({ taken_at: NaN as any })
    expect(() => normalizeContent(item, 'media', 'owner_user')).not.toThrow()
    expect(normalizeContent(item, 'media', 'owner_user')?.timestamp).toBeNull()
  })

  it('sets timestamp to null when taken_at is absent', () => {
    const item = makeMediaItem({ taken_at: undefined })
    const result = normalizeContent(item, 'media', 'owner_user')
    expect(result?.timestamp).toBeNull()
  })

  it('returns null when neither pk nor id is present (unusable content)', () => {
    const result = normalizeContent({ code: 'x' }, 'media', 'owner_user')
    expect(result).toBeNull()
  })
})

describe('dedupeContents', () => {
  it('removes duplicate content by id', () => {
    const a = normalizeContent(makeMediaItem({ pk: 1, code: 'A' }), 'media', 'owner')!
    const b = normalizeContent(makeMediaItem({ pk: 1, code: 'A' }), 'clip', 'owner')!
    const result = dedupeContents([a, b])
    expect(result).toHaveLength(1)
  })

  it('keeps distinct content ids from media and clips collections', () => {
    const a = normalizeContent(makeMediaItem({ pk: 1, code: 'A' }), 'media', 'owner')!
    const b = normalizeContent(makeMediaItem({ pk: 2, code: 'B' }), 'clip', 'owner')!
    const result = dedupeContents([a, b])
    expect(result).toHaveLength(2)
  })

  it('also dedupes by shortcode when ids differ but shortcode matches', () => {
    const a = normalizeContent(makeMediaItem({ pk: 1, code: 'SAME' }), 'media', 'owner')!
    const b = normalizeContent(makeMediaItem({ pk: 2, code: 'SAME' }), 'clip', 'owner')!
    const result = dedupeContents([a, b])
    expect(result).toHaveLength(1)
  })
})
