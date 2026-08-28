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
})
