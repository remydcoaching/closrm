import { describe, it, expect, vi } from 'vitest'
import { buildPriorityQueue } from '../priority'

function makeSupabaseStub(responses: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = responses[table] ?? []
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.lt = chain
      builder.is = chain
      builder.order = chain
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null })
      return builder
    },
  }
}

describe('buildPriorityQueue', () => {
  it('orders leads with overdue follow-ups before never-recontacted leads', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-overdue', scheduled_at: '2026-01-01T00:00:00Z' }],
      instagram_interactions: [],
      leads: [
        { id: 'lead-overdue', last_activity_at: '2026-01-01T00:00:00Z' },
        { id: 'lead-stale', last_activity_at: '2025-01-01T00:00:00Z' },
      ],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue[0]).toEqual({ lead_id: 'lead-overdue', category: 'relance_en_retard' })
    expect(queue.some((q) => q.lead_id === 'lead-stale' && q.category === 'jamais_recontacte')).toBe(true)
  })

  it('deduplicates a lead present in multiple categories, keeping the highest-priority one', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-both', scheduled_at: '2026-01-01T00:00:00Z' }],
      instagram_interactions: [{ lead_id: 'lead-both', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [{ id: 'lead-both', last_activity_at: '2026-01-02T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue).toHaveLength(1)
    expect(queue[0].category).toBe('relance_en_retard')
  })

  it('returns a lead with no follow_ups/calls rows under premier_message', async () => {
    // last_activity_at is set to "now" so it never satisfies the
    // jamais_recontacte staleness check regardless of when this test runs,
    // isolating the premier_message path (both queries share the `leads`
    // fixture in this stub, since the stub's chain() ignores .lt()/.eq()).
    const recentIso = new Date().toISOString()
    const supabase = makeSupabaseStub({
      follow_ups: [],
      calls: [],
      instagram_interactions: [],
      leads: [{ id: 'lead-new', last_activity_at: recentIso, created_at: recentIso }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue.some((q) => q.lead_id === 'lead-new' && q.category === 'premier_message')).toBe(true)
  })

  it('excludes a lead with any follow_ups row from premier_message', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-contacted', scheduled_at: '2020-01-01T00:00:00Z', status: 'fait' }],
      calls: [],
      instagram_interactions: [],
      leads: [{ id: 'lead-contacted', created_at: '2026-01-01T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue.some((q) => q.lead_id === 'lead-contacted' && q.category === 'premier_message')).toBe(false)
  })

  it('excludes a lead with a pending follow-up from jamais_recontacte and engagement_instagram', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-pending', scheduled_at: '2027-01-01T00:00:00Z', status: 'en_attente' }],
      calls: [],
      instagram_interactions: [{ lead_id: 'lead-pending', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [{ id: 'lead-pending', last_activity_at: '2025-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30)

    expect(queue.some((q) => q.lead_id === 'lead-pending' && q.category === 'jamais_recontacte')).toBe(false)
    expect(queue.some((q) => q.lead_id === 'lead-pending' && q.category === 'engagement_instagram')).toBe(false)
  })
})
