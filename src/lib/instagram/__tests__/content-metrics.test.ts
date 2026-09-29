import { describe, expect, it } from 'vitest'
import { buildContentMetrics, latestPerContent, type DiscoveryContentRow } from '../content-metrics'

function row(overrides: Partial<DiscoveryContentRow> = {}): DiscoveryContentRow {
  return {
    discovery_run_id: 'run1',
    content_id: 'c1',
    content_type: 'clip',
    content_url: null,
    thumbnail_url: null,
    published_at: null,
    view_count: 1000,
    reported_like_count: 40,
    reported_comment_count: 10,
    created_at: '2026-09-20T00:00:00Z',
    ...overrides,
  }
}

describe('latestPerContent', () => {
  it('keeps only the most recent scan of each content', () => {
    const out = latestPerContent([
      row({ discovery_run_id: 'old', created_at: '2026-09-01T00:00:00Z' }),
      row({ discovery_run_id: 'new', created_at: '2026-09-20T00:00:00Z' }),
      row({ content_id: 'c2' }),
    ])
    expect(out).toHaveLength(2)
    expect(out.find((r) => r.content_id === 'c1')?.discovery_run_id).toBe('new')
  })
})

describe('buildContentMetrics', () => {
  it('uses Instagram public counters for the engagement rate', () => {
    const m = buildContentMetrics(row(), { likers: 30, commenters: 5, leads: 2 })
    expect(m.engagementRate).toBeCloseTo(0.05)
    expect(m.likesCount).toBe(40)
    expect(m.identifiedLikers).toBe(30)
    expect(m.leadsCount).toBe(2)
  })

  it('falls back to observed counts when Instagram hides its counters', () => {
    const m = buildContentMetrics(row({ reported_like_count: null, reported_comment_count: null }), { likers: 30, commenters: 5, leads: 0 })
    expect(m.likesCount).toBe(30)
    expect(m.engagementRate).toBeCloseTo(0.035)
  })

  it('has no rate without views', () => {
    expect(buildContentMetrics(row({ view_count: null }), { likers: 1, commenters: 0, leads: 0 }).engagementRate).toBeNull()
    expect(buildContentMetrics(row({ view_count: 0 }), { likers: 1, commenters: 0, leads: 0 }).views).toBeNull()
  })
})
