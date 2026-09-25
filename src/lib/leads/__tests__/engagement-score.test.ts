// Unit tests for the shared engagement scoring logic — the same rules
// GET /api/leads/hot uses, exercised here for a single lead. Uses a minimal
// chainable Supabase query builder mock (test-only, never a stand-in for
// production data) rather than duplicating the heavier in-memory Supabase
// fixture from src/lib/hiker/__tests__/integration/.
import { describe, it, expect, vi } from 'vitest'
import { computeEngagementScore, DEFAULT_SCORING } from '../engagement-score'

interface TableData {
  leads?: Record<string, unknown>[]
  engagement_scoring_rules?: Record<string, unknown>[]
  instagram_interactions?: Record<string, unknown>[]
  follow_ups?: Record<string, unknown>[]
}

function buildSupabaseMock(data: TableData) {
  return {
    from(table: keyof TableData) {
      const rows = data[table] ?? []
      const builder = {
        _rows: rows,
        select() {
          return builder
        },
        eq() {
          return builder
        },
        order() {
          return builder
        },
        limit(n: number) {
          builder._rows = builder._rows.slice(0, n)
          return builder
        },
        maybeSingle() {
          return Promise.resolve({ data: builder._rows[0] ?? null, error: null })
        },
        then(resolve: (v: { data: unknown[]; error: null }) => void) {
          resolve({ data: builder._rows, error: null })
        },
      }
      return builder
    },
  }
}

describe('computeEngagementScore', () => {
  it('returns null when the lead does not exist in this workspace', async () => {
    const supabase = buildSupabaseMock({ leads: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-404')
    expect(result).toBeNull()
  })

  it('scores using DEFAULT_SCORING when no workspace override exists', async () => {
    const supabase = buildSupabaseMock({
      leads: [{ id: 'lead-1', last_activity_at: new Date().toISOString() }],
      engagement_scoring_rules: [],
      instagram_interactions: [
        { interaction_type: 'like', source_post_id: 'p1', first_seen_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-09-01T00:00:00Z' },
        { interaction_type: 'comment', source_post_id: 'p1', first_seen_at: '2026-09-02T00:00:00Z', last_seen_at: '2026-09-02T00:00:00Z' },
      ],
      follow_ups: [],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-1')
    expect(result?.score).toBe(DEFAULT_SCORING.like + DEFAULT_SCORING.comment)
    expect(result?.likesCount).toBe(1)
    expect(result?.commentsCount).toBe(1)
  })

  it('applies a workspace-configured scoring rule instead of the default', async () => {
    const supabase = buildSupabaseMock({
      leads: [{ id: 'lead-1', last_activity_at: new Date().toISOString() }],
      engagement_scoring_rules: [{ interaction_type: 'like', points: 10 }],
      instagram_interactions: [
        { interaction_type: 'like', source_post_id: 'p1', first_seen_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-09-01T00:00:00Z' },
      ],
      follow_ups: [],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-1')
    expect(result?.score).toBe(10)
  })

  it('produces a data-backed signal for interactions spread across multiple contents', async () => {
    const supabase = buildSupabaseMock({
      leads: [{ id: 'lead-1', last_activity_at: new Date().toISOString() }],
      engagement_scoring_rules: [],
      instagram_interactions: [
        { interaction_type: 'like', source_post_id: 'p1', first_seen_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-09-01T00:00:00Z' },
        { interaction_type: 'like', source_post_id: 'p2', first_seen_at: '2026-09-02T00:00:00Z', last_seen_at: '2026-09-02T00:00:00Z' },
      ],
      follow_ups: [],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-1')
    expect(result?.signals.some((s) => s.key === 'multi_content')).toBe(true)
  })

  it('never fabricates a signal when there is no supporting data', async () => {
    const supabase = buildSupabaseMock({
      leads: [{ id: 'lead-1', last_activity_at: new Date().toISOString() }],
      engagement_scoring_rules: [],
      instagram_interactions: [],
      follow_ups: [],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-1')
    expect(result?.score).toBe(0)
    expect(result?.signals).toEqual([])
  })

  it('flags an overdue pending follow-up as a signal', async () => {
    const supabase = buildSupabaseMock({
      leads: [{ id: 'lead-1', last_activity_at: new Date().toISOString() }],
      engagement_scoring_rules: [],
      instagram_interactions: [],
      follow_ups: [{ scheduled_at: '2020-01-01T00:00:00Z' }],
    })
    vi.useRealTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await computeEngagementScore(supabase as any, 'ws-1', 'lead-1')
    expect(result?.signals.some((s) => s.key === 'overdue_followup')).toBe(true)
  })
})
