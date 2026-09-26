import { describe, expect, it } from 'vitest'
import { classifyFailure, parseOwnReel, parseViewersPage } from '../instagram-parse'

describe('parseOwnReel', () => {
  it('reads items from reels[userId] with pk, dates, type, thumbnail and viewer count', () => {
    const body = {
      reels: {
        '42': {
          items: [
            {
              pk: '3001',
              taken_at: 1758880000,
              expiring_at: 1758966400,
              media_type: 2,
              total_viewer_count: 61,
              image_versions2: { candidates: [{ url: 'https://cdn/big.jpg' }, { url: 'https://cdn/small.jpg' }] },
            },
            { pk: '3002' }, // no taken_at → dropped
          ],
        },
      },
    }
    const out = parseOwnReel(body, '42')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ pk: '3001', mediaType: 'video', viewerCount: 61, thumbnailUrl: 'https://cdn/small.jpg' })
    expect(out[0].takenAt).toBe(new Date(1758880000 * 1000).toISOString())
  })

  it('falls back to reels_media[0] and returns [] on garbage', () => {
    expect(parseOwnReel({ reels_media: [{ items: [{ id: '5_42', taken_at: 1 }] }] }, '42')[0].pk).toBe('5')
    expect(parseOwnReel(null, '42')).toEqual([])
    expect(parseOwnReel({ reels: {} }, '42')).toEqual([])
  })
})

describe('parseViewersPage', () => {
  it('parses users and the cursor, dropping malformed ones and non-https pictures', () => {
    const page = parseViewersPage({
      users: [
        { pk: 1, username: 'alice', full_name: 'Alice', profile_pic_url: 'https://cdn/a.jpg', is_verified: true },
        { pk: 2, username: 'bob', profile_pic_url: 'javascript:alert(1)' },
        { username: 'nopk' },
      ],
      next_max_id: 'abc',
    })
    expect(page.viewers).toEqual([
      { pk: '1', username: 'alice', fullName: 'Alice', profilePicUrl: 'https://cdn/a.jpg', isVerified: true },
      { pk: '2', username: 'bob', fullName: null, profilePicUrl: null, isVerified: null },
    ])
    expect(page.nextMaxId).toBe('abc')
  })
})

describe('classifyFailure', () => {
  it('categorises Instagram failures', () => {
    expect(classifyFailure(429, {})).toBe('rate_limited')
    expect(classifyFailure(400, { message: 'checkpoint_required' })).toBe('checkpoint')
    expect(classifyFailure(403, { message: 'login_required' })).toBe('not_connected')
    expect(classifyFailure(500, {})).toBe('error')
  })
})
