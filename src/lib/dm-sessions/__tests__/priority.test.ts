import { describe, it, expect } from 'vitest'
import { buildPriorityQueue, type SessionCategoryFilter } from '../priority'

const ALL_ON: SessionCategoryFilter = {
  relanceEnRetard: true,
  premierContact: true,
  jamaisRecontacte: true,
}

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
      // The real query filters leads to those with a non-null
      // dm_conversation_active_at; the stub can't evaluate PostgREST
      // filter semantics, so it approximates by only returning rows that
      // actually carry that field, keeping the "active conversation" leads
      // query distinct from the plain `leads` fixture used everywhere else.
      builder.not = (column: string) => {
        if (column === 'dm_conversation_active_at') {
          builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: rows.filter((r) => (r as Record<string, unknown>).dm_conversation_active_at != null), error: null })
        }
        return builder
      }
      builder.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null })
      return builder
    },
  }
}

describe('buildPriorityQueue', () => {
  it('splits a pending follow-up into relance_du_jour (today) vs relance_en_retard (before today)', async () => {
    const now = new Date()
    const todayAt9am = new Date(now)
    todayAt9am.setHours(9, 0, 0, 0)
    const yesterday = new Date(now.getTime() - 2 * 86_400_000)

    const supabase = makeSupabaseStub({
      follow_ups: [
        { lead_id: 'lead-today', scheduled_at: todayAt9am.toISOString() },
        { lead_id: 'lead-overdue', scheduled_at: yesterday.toISOString() },
      ],
      instagram_interactions: [],
      leads: [],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.find((q) => q.lead_id === 'lead-today')?.category).toBe('relance_du_jour')
    expect(queue.find((q) => q.lead_id === 'lead-overdue')?.category).toBe('relance_en_retard')
  })

  it('includes relance_du_jour scheduled earlier today even though the exact time has not passed yet', async () => {
    // Reproduces the original bug: comparing against `now` (exact instant)
    // instead of the start of today caused a follow-up scheduled for later
    // today to never surface until its exact time-of-day had elapsed.
    const now = new Date()
    const laterToday = new Date(now)
    laterToday.setHours(23, 0, 0, 0)
    // Guard: only meaningful if "later today" is actually still ahead of now.
    if (laterToday.getTime() <= now.getTime()) laterToday.setDate(laterToday.getDate())

    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-later-today', scheduled_at: laterToday.toISOString() }],
      instagram_interactions: [],
      leads: [],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.some((q) => q.lead_id === 'lead-later-today' && q.category === 'relance_du_jour')).toBe(true)
  })

  it('orders relance_du_jour before relance_en_retard, both before never-recontacted leads', async () => {
    const now = new Date()
    const todayAt9am = new Date(now)
    todayAt9am.setHours(9, 0, 0, 0)
    const yesterday = new Date(now.getTime() - 2 * 86_400_000)

    const supabase = makeSupabaseStub({
      follow_ups: [
        { lead_id: 'lead-today', scheduled_at: todayAt9am.toISOString() },
        { lead_id: 'lead-overdue', scheduled_at: yesterday.toISOString() },
      ],
      instagram_interactions: [],
      leads: [
        { id: 'lead-stale', last_activity_at: '2025-01-01T00:00:00Z' },
      ],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    const indexOf = (id: string) => queue.findIndex((q) => q.lead_id === id)
    expect(indexOf('lead-today')).toBeLessThan(indexOf('lead-overdue'))
    expect(indexOf('lead-overdue')).toBeLessThan(indexOf('lead-stale'))
  })

  it('always includes relance_du_jour regardless of the category filter', async () => {
    const now = new Date()
    const todayAt9am = new Date(now)
    todayAt9am.setHours(9, 0, 0, 0)

    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-today', scheduled_at: todayAt9am.toISOString() }],
      instagram_interactions: [],
      leads: [],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, {
      relanceEnRetard: false,
      premierContact: false,
      jamaisRecontacte: false,
    })

    expect(queue.some((q) => q.lead_id === 'lead-today' && q.category === 'relance_du_jour')).toBe(true)
  })

  it('excludes relance_en_retard leads when the filter turns it off', async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000)
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-overdue', scheduled_at: yesterday.toISOString() }],
      instagram_interactions: [],
      leads: [],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, {
      relanceEnRetard: false,
      premierContact: true,
      jamaisRecontacte: true,
    })

    expect(queue.some((q) => q.lead_id === 'lead-overdue')).toBe(false)
  })

  it('excludes premier_message and engagement_instagram leads when premierContact filter is off', async () => {
    const recentIso = new Date().toISOString()
    const supabase = makeSupabaseStub({
      follow_ups: [],
      calls: [],
      instagram_interactions: [{ lead_id: 'lead-engaged', last_seen_at: recentIso }],
      leads: [{ id: 'lead-new', last_activity_at: recentIso, created_at: recentIso }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, {
      relanceEnRetard: true,
      premierContact: false,
      jamaisRecontacte: true,
    })

    expect(queue.some((q) => q.lead_id === 'lead-engaged')).toBe(false)
    expect(queue.some((q) => q.lead_id === 'lead-new')).toBe(false)
  })

  it('excludes jamais_recontacte leads when that filter is off', async () => {
    // A follow_ups row (any status/date) keeps lead-stale out of
    // premier_message so this test isolates the jamais_recontacte filter
    // specifically; the far-future date keeps it out of relance_du_jour /
    // relance_en_retard too (the stub doesn't filter by status server-side).
    const future = new Date(Date.now() + 365 * 86_400_000)
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-stale', scheduled_at: future.toISOString(), status: 'fait' }],
      calls: [],
      instagram_interactions: [],
      leads: [{ id: 'lead-stale', last_activity_at: '2025-01-01T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, {
      relanceEnRetard: true,
      premierContact: true,
      jamaisRecontacte: false,
    })

    expect(queue.some((q) => q.lead_id === 'lead-stale')).toBe(false)
  })

  it('deduplicates a lead present in multiple categories, keeping the highest-priority one', async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000)
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-both', scheduled_at: yesterday.toISOString() }],
      instagram_interactions: [{ lead_id: 'lead-both', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [{ id: 'lead-both', last_activity_at: '2026-01-02T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

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

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.some((q) => q.lead_id === 'lead-new' && q.category === 'premier_message')).toBe(true)
  })

  it('excludes a lead with any follow_ups row from premier_message', async () => {
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-contacted', scheduled_at: '2020-01-01T00:00:00Z', status: 'fait' }],
      calls: [],
      instagram_interactions: [],
      leads: [{ id: 'lead-contacted', created_at: '2026-01-01T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.some((q) => q.lead_id === 'lead-contacted' && q.category === 'premier_message')).toBe(false)
  })

  it('excludes a lead with a pending follow-up from jamais_recontacte and engagement_instagram', async () => {
    const future = new Date(Date.now() + 30 * 86_400_000)
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-pending', scheduled_at: future.toISOString(), status: 'en_attente' }],
      calls: [],
      instagram_interactions: [{ lead_id: 'lead-pending', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [{ id: 'lead-pending', last_activity_at: '2025-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.some((q) => q.lead_id === 'lead-pending' && q.category === 'jamais_recontacte')).toBe(false)
    expect(queue.some((q) => q.lead_id === 'lead-pending' && q.category === 'engagement_instagram')).toBe(false)
  })

  it('excludes a lead with an active dm conversation from every category', async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000)
    const supabase = makeSupabaseStub({
      follow_ups: [{ lead_id: 'lead-replied', scheduled_at: yesterday.toISOString(), status: 'en_attente' }],
      calls: [],
      instagram_interactions: [{ lead_id: 'lead-replied', last_seen_at: '2026-01-02T00:00:00Z' }],
      leads: [
        { id: 'lead-replied', last_activity_at: '2025-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', dm_conversation_active_at: '2026-01-03T00:00:00Z' },
      ],
    })

    const queue = await buildPriorityQueue(supabase as never, 'ws-1', 30, ALL_ON)

    expect(queue.some((q) => q.lead_id === 'lead-replied')).toBe(false)
  })
})
