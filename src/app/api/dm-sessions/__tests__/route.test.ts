import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))
vi.mock('@/lib/dm-sessions/priority', () => ({
  buildPriorityQueue: vi.fn().mockResolvedValue([
    { lead_id: 'lead-1', category: 'relance_en_retard' },
    { lead_id: 'lead-2', category: 'jamais_recontacte' },
  ]),
}))

const insertSession = vi.fn()
const insertItems = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'dm_sessions') {
        return {
          insert: insertSession.mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'session-1', status: 'active' }, error: null }),
        }
      }
      if (table === 'dm_session_items') {
        return {
          insert: insertItems.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'item-1', lead_id: 'lead-1', position: 0, category: 'relance_en_retard' },
                { id: 'item-2', lead_id: 'lead-2', position: 1, category: 'jamais_recontacte' },
              ],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from '../route'

describe('POST /api/dm-sessions', () => {
  beforeEach(() => {
    insertSession.mockClear()
    insertItems.mockClear()
  })

  it('creates a session truncated to target_count and returns ordered items', async () => {
    const req = new Request('http://localhost/api/dm-sessions', {
      method: 'POST',
      body: JSON.stringify({ target_count: 1 }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].lead_id).toBe('lead-1')
  })
})
