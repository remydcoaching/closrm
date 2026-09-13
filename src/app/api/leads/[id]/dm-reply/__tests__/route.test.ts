import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

const leadUpdateEq = vi.fn().mockResolvedValue({ error: null })
const followUpUpdateEq3 = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'lead-1' }, error: null }),
          update: vi.fn().mockReturnValue({ eq: leadUpdateEq }),
        }
      }
      if (table === 'follow_ups') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ eq: followUpUpdateEq3 }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from '../route'

describe('POST /api/leads/[id]/dm-reply', () => {
  it('marks the conversation active and cancels pending follow-ups', async () => {
    const res = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'lead-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.lead_id).toBe('lead-1')
    expect(leadUpdateEq).toHaveBeenCalledWith('id', 'lead-1')
    expect(followUpUpdateEq3).toHaveBeenCalledWith('status', 'en_attente')
  })

  it('404s when the lead does not belong to the workspace', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      from: () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never)

    const res = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'lead-404' }),
    })

    expect(res.status).toBe(404)
  })
})
