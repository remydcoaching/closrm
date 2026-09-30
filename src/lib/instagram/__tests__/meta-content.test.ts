import { describe, expect, it } from 'vitest'
import { mediaIdToShortcode, shortcodeToMediaId } from '../shortcode'
import { applyMeta, buildContentMetrics, rowFromMeta, withMeta, type DiscoveryContentRow, type MetaReelRow } from '../content-metrics'
import { planCommentInteractions } from '../meta-comments-sync'
import { estimatedCost, needsCommentsRead, pickDueContents, type MonitoredContent } from '../monitor/policy'

describe('shortcode ↔ media pk (links Meta publications to Hiker ones)', () => {
  it('round-trips real-size pks and shortcodes', () => {
    for (const pk of ['3985953780581736435', '3994897692151668478', '1']) expect(shortcodeToMediaId(mediaIdToShortcode(pk))).toBe(pk)
    for (const code of ['DdQ89hOsx_z', 'Dcs7eZzsY--']) expect(mediaIdToShortcode(shortcodeToMediaId(code))).toBe(code)
  })
  it('rejects anything that is not a shortcode', () => {
    expect(shortcodeToMediaId('')).toBe('')
    expect(shortcodeToMediaId('abc/def')).toBe('')
  })
})

const meta: MetaReelRow = { ig_media_id: '17900', shortcode: 'DdQ89hOsx_z', permalink: 'https://www.instagram.com/reel/DdQ89hOsx_z/', caption: 'Pec', thumbnail_url: 'https://x/t.jpg', views: 12866, likes: 118, comments: 4, reach: 10683, saves: 73, shares: 22, published_at: '2026-09-14T10:45:05Z' }
const hiker: DiscoveryContentRow = { discovery_run_id: 'run1', content_id: '3985953780581736435', content_type: 'clip', content_url: null, thumbnail_url: null, published_at: '2026-09-14T10:45:05Z', view_count: 9000, reported_like_count: 12, reported_comment_count: 1, created_at: '2026-09-20' }

describe('Content page figures', () => {
  it("Meta's official counters replace Hiker's on a scanned content, identified likers stay", () => {
    const m = withMeta(buildContentMetrics(applyMeta(hiker, meta), { likers: 40, commenters: 2, leads: 3 }), meta, true)
    expect(m).toMatchObject({ views: 12866, likesCount: 118, commentsCount: 4, reach: 10683, saves: 73, shares: 22, identifiedLikers: 40, leadsCount: 3, source: 'meta+hiker' })
  })
  it('a publication Hiker never scanned is listed from Meta, under its media pk', () => {
    const m = withMeta(buildContentMetrics(rowFromMeta(meta, shortcodeToMediaId(meta.shortcode as string)), { likers: 0, commenters: 3, leads: 0 }), meta, false)
    expect(m).toMatchObject({ contentId: '3985953780581736435', contentUrl: meta.permalink, views: 12866, identifiedLikers: 0, identifiedCommenters: 3, source: 'meta', runId: '' })
  })
})

describe('comments from the Meta API → lead journey', () => {
  const leads = new Map([['alice', 'lead-a']])
  it('one interaction per lead × publication, dated by Instagram, never twice', () => {
    const rows = planCommentInteractions('ws', [
      { mediaPk: '1', username: 'Alice', text: 'second', timestamp: '2026-09-15T10:00:00Z' },
      { mediaPk: '1', username: 'alice', text: 'first', timestamp: '2026-09-14T11:00:00Z' },
      { mediaPk: '2', username: 'alice', text: 'other post', timestamp: '2026-09-16T09:00:00Z' },
      { mediaPk: '1', username: 'bob', text: 'not a lead', timestamp: '2026-09-14T11:00:00Z' },
    ], leads, new Set(['lead-a|comment|2']))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ lead_id: 'lead-a', source_post_id: '1', first_seen_at: '2026-09-14T11:00:00Z', source_provider: 'meta', metadata: { comment_text: 'first' } })
  })
})

describe('publication monitor with the Meta API connected', () => {
  const c: MonitoredContent = { content_id: 'c', published_at: null, next_scan_at: '2026-01-01T00:00:00Z', reported_comment_count: 50, comments_read_at_count: 0, last_scanned_at: null, last_status: null }
  it('Hiker reads likers only (1 request), comments come from Meta', () => {
    expect(needsCommentsRead(c)).toBe(true)
    expect(needsCommentsRead(c, true)).toBe(false)
    expect(estimatedCost(c)).toBeGreaterThan(1)
    expect(estimatedCost(c, true)).toBe(1)
    expect(pickDueContents([c, { ...c, content_id: 'd' }], Date.parse('2026-02-01'), 2, true)).toHaveLength(2)
  })
})
