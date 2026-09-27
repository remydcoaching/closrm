import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'instagram_interactions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'ig-1',
                interaction_type: 'like',
                source_post_url: 'https://instagram.com/reel/xyz',
                last_seen_at: '2026-06-21T00:00:00Z',
                metadata: { snippet: 'Tu as un problème de confiance.' },
              },
            ],
            error: null,
          }),
        }
      }
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'lead-1',
              first_name: 'Jane',
              last_name: 'Doe',
              source: 'instagram',
              visitor_id: null,
              form_answers: {},
              meta_campaign_id: null,
              meta_adset_id: null,
              meta_ad_id: null,
              notes: null,
              created_at: '2026-06-20T00:00:00Z',
            },
            error: null,
          }),
        }
      }
      // other tables (funnel events, bookings) stubbed to empty —
      // this test only asserts the instagram_interactions merge.
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      }
    },
  }),
}))

import { GET } from '../route'

describe('GET /api/leads/[id]/journey', () => {
  it('includes instagram_like events sourced from instagram_interactions', async () => {
    const res = await GET(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'lead-1' }),
    })
    const body = await res.json()

    const igEvent = body.data.events.find((e: { event_type: string }) => e.event_type === 'instagram_like')
    expect(igEvent).toBeDefined()
    expect(igEvent.metadata.source_post_url).toBe('https://instagram.com/reel/xyz')
  })
})
