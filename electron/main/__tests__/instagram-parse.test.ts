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
    expect(out[0]).toMatchObject({ pk: '3001', mediaType: 'video', viewerCount: 61, thumbnailUrl: 'https://cdn/big.jpg' })
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
        { pk: 2, username: 'bob', profile_pic_url: 'javascript:alert(1)', has_liked: true, is_private: true },
        { username: 'nopk' },
      ],
      next_max_id: 'abc',
    })
    expect(page.viewers).toEqual([
      { pk: '1', username: 'alice', fullName: 'Alice', profilePicUrl: 'https://cdn/a.jpg', isVerified: true, hasLiked: null, isPrivate: null, replyText: null },
      { pk: '2', username: 'bob', fullName: null, profilePicUrl: null, isVerified: null, hasLiked: true, isPrivate: true, replyText: null },
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

import { parseArchiveDayShells, parseReelsMediaItems } from '../instagram-parse'

describe('parseArchiveDayShells', () => {
  it('keeps archiveDay ids and the cursor when more are available', () => {
    expect(parseArchiveDayShells({ items: [{ id: 'archiveDay:1' }, { id: 'other' }, {}], more_available: true, max_id: 'm' })).toEqual({ ids: ['archiveDay:1'], maxId: 'm' })
    expect(parseArchiveDayShells({ items: [], more_available: false, max_id: 'm' }).maxId).toBeNull()
  })
})

describe('parseReelsMediaItems', () => {
  it('flattens every reel, newest first, with image and video urls', () => {
    const out = parseReelsMediaItems({
      reels: {
        'archiveDay:1': { items: [{ pk: '1', taken_at: 100, media_type: 1, image_versions2: { candidates: [{ url: 'https://i/1.jpg' }] } }] },
        'archiveDay:2': {
          items: [{ pk: '2', taken_at: 200, media_type: 2, video_versions: [{ url: 'https://v/2.mp4' }], image_versions2: { candidates: [{ url: 'https://i/2.jpg' }] }, viewer_count: 12 }],
        },
      },
    })
    expect(out.map((s) => s.pk)).toEqual(['2', '1'])
    expect(out[0]).toMatchObject({ mediaType: 'video', videoUrl: 'https://v/2.mp4', imageUrl: 'https://i/2.jpg', viewerCount: 12 })
    expect(out[1]).toMatchObject({ mediaType: 'image', videoUrl: null })
  })
})


import { parseHighlightItems, parseHighlightsTray } from '../instagram-parse'

describe('parseHighlightsTray', () => {
  it('reads collections with title, cover and count', () => {
    expect(
      parseHighlightsTray({
        tray: [
          { id: 'highlight:1', title: 'Clients 22', media_count: 7, cover_media: { cropped_image_version: { url: 'https://c/1.jpg' } } },
          { id: 'weird', title: 'x' },
        ],
      }),
    ).toEqual([{ id: 'highlight:1', title: 'Clients 22', coverUrl: 'https://c/1.jpg', mediaCount: 7 }])
  })
})

describe('parseHighlightItems', () => {
  it('groups items by highlight and reads like counts', () => {
    const m = parseHighlightItems({ reels: { 'highlight:1': { items: [{ pk: '9', taken_at: 5, media_type: 1, like_count: 386 }] } } })
    expect(m.get('highlight:1')?.[0]).toMatchObject({ pk: '9', likeCount: 386 })
  })
})

describe('feed/user/:id/story/ shape', () => {
  it('reads the single reel object', () => {
    const body = { reel: { user: { username: 'coach' }, items: [{ pk: '7', taken_at: 10, media_type: 1 }] } }
    expect(parseOwnReel(body, '42')[0].pk).toBe('7')
    expect(parseReelsMediaItems(body)[0].pk).toBe('7')
  })
})

import { parseGraphqlHighlights } from '../instagram-parse'

describe('viewers[] facts', () => {
  it('reads has_liked and reply_text from viewers[] and users from it when users[] is empty', () => {
    const page = parseViewersPage({
      users: [],
      viewers: [
        { user: { pk: 1, username: 'alice' }, has_liked: true, reply_text: 'Top 🔥' },
        { user: { pk: 2, username: 'bob' }, has_liked: false, reply_text: '' },
      ],
    })
    expect(page.viewers.map((v) => [v.username, v.hasLiked, v.replyText])).toEqual([
      ['alice', true, 'Top 🔥'],
      ['bob', false, null],
    ])
  })
  it('merges viewers[] facts into users[] profiles', () => {
    const page = parseViewersPage({ users: [{ pk: 1, username: 'alice', full_name: 'Alice' }], viewers: [{ user: { pk: 1 }, has_liked: true }] })
    expect(page.viewers[0]).toMatchObject({ fullName: 'Alice', hasLiked: true })
  })
})

describe('parseGraphqlHighlights', () => {
  it('reads highlight reels as highlight:<id>', () => {
    const out = parseGraphqlHighlights({ data: { user: { edge_highlight_reels: { edges: [{ node: { id: '182', title: 'QUI SUIS-JE', cover_media_cropped_thumbnail: { url: 'https://c/x.jpg' } } }] } } } })
    expect(out).toEqual([{ id: 'highlight:182', title: 'QUI SUIS-JE', coverUrl: 'https://c/x.jpg', mediaCount: null }])
  })
})
