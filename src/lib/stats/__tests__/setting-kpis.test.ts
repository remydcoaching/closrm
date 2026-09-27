import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { fetchSettingKpis } from '../setting-kpis'

/**
 * `fetchSettingKpis` queries the `leads` table twice (nouveauxLeads and
 * totalRepIg), so a stub keyed only by table name can't tell them apart.
 * Track per-table call order instead: each `.from('leads')` invocation
 * returns the next entry in that table's queue.
 */
function makeSupabaseStub(counts: Record<string, number[]>) {
  const callIndex: Record<string, number> = {}
  return {
    from(table: string) {
      const idx = callIndex[table] ?? 0
      callIndex[table] = idx + 1
      const count = (counts[table] ?? [])[idx] ?? 0

      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.not = chain
      builder.gte = chain
      builder.then = (resolve: (v: { count: number; data: null; error: null }) => void) =>
        resolve({ count, data: null, error: null })
      return builder
    },
  }
}

describe('fetchSettingKpis', () => {
  it('maps each query to the right field', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseStub({
        calls: [5],
        leads: [20, 4], // [nouveauxLeads, totalRepIg] — queried in that order
        dm_session_items: [10],
      }) as never
    )

    const result = await fetchSettingKpis('ws-1', 0)

    expect(result.callsBookes).toBe(5)
    expect(result.nouveauxLeads).toBe(20)
    expect(result.totalConvIg).toBe(10)
    expect(result.totalRepIg).toBe(4)
    expect(result.tauxReponse).toBe(40)
  })

  it('returns null tauxReponse when there are zero conversations', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseStub({ calls: [0], leads: [0, 0], dm_session_items: [0] }) as never
    )

    const result = await fetchSettingKpis('ws-1', 7)

    expect(result.totalConvIg).toBe(0)
    expect(result.tauxReponse).toBeNull()
  })

  it('rounds tauxReponse to one decimal place', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseStub({ calls: [0], leads: [0, 1], dm_session_items: [3] }) as never
    )

    const result = await fetchSettingKpis('ws-1', 0)

    // 1 / 3 * 100 = 33.333... -> rounded to 33.3
    expect(result.tauxReponse).toBe(33.3)
  })
})
