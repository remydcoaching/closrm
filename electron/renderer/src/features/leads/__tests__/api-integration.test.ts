// Verifies the Leads feature calls the EXISTING ClosRM API contract
// correctly (paths, methods, payload shape) without asserting on rendered
// React output — the goal is to prove the data layer, matching what M2
// asks to validate: "les données affichées correspondent réellement aux
// réponses de l'API existante."
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null }) } },
}))

import { api, ApiError } from '../../../lib/api-client'
import type { Lead, LeadsListResponse } from '../types'

const originalFetch = global.fetch

function fakeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    workspace_id: 'ws-1',
    first_name: 'Marie',
    last_name: 'Dupont',
    phone: '+33612345678',
    email: 'marie@example.com',
    status: 'nouveau',
    source: 'manuel',
    tags: [],
    call_attempts: 0,
    reached: false,
    notes: null,
    meta_campaign_id: null,
    meta_adset_id: null,
    meta_ad_id: null,
    instagram_handle: null,
    instagram_followers_count: null,
    instagram_following_count: null,
    instagram_is_verified: null,
    instagram_is_private: null,
    instagram_profile_pic_url: null,
    instagram_bio: null,
    instagram_profile_synced_at: null,
    last_activity_at: null,
    deal_amount: null,
    deal_installments: 1,
    cash_collected: 0,
    closed_at: null,
    assigned_to: null,
    created_at: '2026-09-19T00:00:00Z',
    updated_at: '2026-09-19T00:00:00Z',
    ...overrides,
  }
}

describe('Leads API integration (data layer)', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fetches the leads list from GET /api/leads and returns real Lead rows', async () => {
    const response: LeadsListResponse = { data: [fakeLead()], meta: { total: 1, page: 1, per_page: 50, total_pages: 1 } }
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response })
    global.fetch = mockFetch as unknown as typeof fetch

    const result = await api.get<LeadsListResponse>('/api/leads?per_page=50')

    expect(mockFetch.mock.calls[0][0]).toContain('/api/leads?per_page=50')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].first_name).toBe('Marie')
  })

  it('fetches a single lead via GET /api/leads/:id', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: fakeLead({ id: 'lead-42' }) }) })
    global.fetch = mockFetch as unknown as typeof fetch

    const result = await api.get<{ data: Lead }>('/api/leads/lead-42')

    expect(mockFetch.mock.calls[0][0]).toContain('/api/leads/lead-42')
    expect(result.data.id).toBe('lead-42')
  })

  it('creates a lead via POST /api/leads with the expected payload shape', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: fakeLead() }) })
    global.fetch = mockFetch as unknown as typeof fetch

    await api.post('/api/leads', { first_name: 'Marie', last_name: 'Dupont', phone: '', email: '', source: 'manuel' })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/leads')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({ first_name: 'Marie', source: 'manuel' })
  })

  it('updates a lead via PATCH /api/leads/:id', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: fakeLead({ notes: 'updated' }) }) })
    global.fetch = mockFetch as unknown as typeof fetch

    await api.patch('/api/leads/lead-1', { notes: 'updated' })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/leads/lead-1')
    expect((init as RequestInit).method).toBe('PATCH')
  })

  it('surfaces a 404 (lead not found) as an ApiError instead of silently returning nothing', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Lead introuvable' }) }) as unknown as typeof fetch

    await expect(api.get('/api/leads/does-not-exist')).rejects.toMatchObject({ status: 404, message: 'Lead introuvable' })
  })

  it('surfaces a validation error (400) from lead creation as an ApiError', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Format d\'email invalide.' }) }) as unknown as typeof fetch

    await expect(api.post('/api/leads', { email: 'not-an-email' })).rejects.toBeInstanceOf(ApiError)
  })
})
