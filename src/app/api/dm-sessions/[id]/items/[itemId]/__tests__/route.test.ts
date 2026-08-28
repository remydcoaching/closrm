import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

const updateItem = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { id: 'item-1', outcome: 'archived', note: null, updated_at: '2026-08-27T00:00:00Z' },
    error: null,
  }),
})
const updateLead = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
const getItem = vi.fn().mockResolvedValue({ data: { lead_id: 'lead-1' }, error: null })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'dm_session_items') {
        return {
          update: updateItem,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: getItem,
        }
      }
      if (table === 'leads') {
        return { update: updateLead }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { PATCH } from '../route'

describe('PATCH /api/dm-sessions/[id]/items/[itemId]', () => {
  it('archives the lead when outcome is archived', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ outcome: 'archived' }),
    })
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.outcome).toBe('archived')
    expect(updateLead).toHaveBeenCalledWith({ status: 'dead' })
  })
})
