import { describe, expect, it } from 'vitest'
import { gesturesFromApify, historyTargets } from '../apify-history'
import { shortcodeToMediaId } from '@/lib/instagram/shortcode'

describe('Apify likes history', () => {
  it('maps rows to likes keyed by the media pk (pk, else shortcode, else post URL); rows without id are skipped', () => {
    const pk = shortcodeToMediaId('DdQ89hOsx_z')
    const g = gesturesFromApify([
      { userId: 1, username: 'anna', fullName: 'Anna', profilePicUrl: 'a.jpg', sourceMediaPk: '42' },
      { userId: '2', username: 'bob', sourceShortCode: 'DdQ89hOsx_z' },
      { userId: '3', username: 'cleo', sourcePostUrl: 'https://www.instagram.com/reel/DdQ89hOsx_z/' },
      { username: 'noid', sourceMediaPk: '42' },
      { userId: '5', username: 'nosource' },
      { id: 6, username: 'dora', full_name: 'Dora', profile_pic_url: 'd.jpg', liked_post: 'https://www.instagram.com/p/DdQ89hOsx_z/' },
    ])
    expect(g.map((x) => [x.contentId, x.instagramUserId, x.type, x.dedupKey])).toEqual([
      ['42', '1', 'like', ''],
      [pk, '2', 'like', ''],
      [pk, '3', 'like', ''],
      [pk, '6', 'like', ''],
    ])
    expect(g[3]).toMatchObject({ fullName: 'Dora', profilePicUrl: 'd.jpg' })
    expect(g[0]).toMatchObject({ username: 'anna', fullName: 'Anna', profilePicUrl: 'a.jpg', commentText: null })
  })

  it('targets: never read, with likes, not deleted — newest first', () => {
    const base = { next_scan_at: '', reported_comment_count: 0, comments_read_at_count: null, likers_seen: 0, comments_seen: 0 }
    const t = historyTargets([
      { ...base, content_id: 'old', published_at: '2025-01-01', last_scanned_at: null, last_status: null, reported_like_count: 5 },
      { ...base, content_id: 'new', published_at: '2026-09-01', last_scanned_at: null, last_status: null, reported_like_count: 9 },
      { ...base, content_id: 'read', published_at: '2026-09-02', last_scanned_at: '2026-09-03', last_status: 'ok', reported_like_count: 9 },
      { ...base, content_id: 'nolikes', published_at: '2026-09-04', last_scanned_at: null, last_status: null, reported_like_count: 0 },
      { ...base, content_id: 'gone', published_at: '2026-09-05', last_scanned_at: null, last_status: 'not_found', reported_like_count: 3 },
    ])
    expect(t.map((c) => c.content_id)).toEqual(['new', 'old'])
  })
})
