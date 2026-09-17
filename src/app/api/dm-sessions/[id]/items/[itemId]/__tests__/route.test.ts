import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'setter' }),
}))

// Mutable state controlled per-test.
let itemLookupResult: { data: { lead_id: string } | null; error: unknown }
let leadUpdateResult: { error: unknown }
let followUpInsertResult: { error: unknown }
let itemUpdateResult: { data: unknown; error: unknown }

const followUpInsert = vi.fn(() => Promise.resolve(followUpInsertResult))
const followUpUpdateEq3 = vi.fn(() => Promise.resolve({ error: null }))
const followUpUpdate = vi.fn(() => ({
  eq: () => ({ eq: () => ({ eq: followUpUpdateEq3 }) }),
}))
const leadUpdateEq = vi.fn(() => Promise.resolve(leadUpdateResult))
const updateLead = vi.fn(() => ({ eq: leadUpdateEq }))
const itemLookupSingle = vi.fn(() => Promise.resolve(itemLookupResult))
const itemUpdateSingle = vi.fn(() => Promise.resolve(itemUpdateResult))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'dm_session_items') {
        return {
          // select(...).eq(...).eq(...).single()  -- item lookup
          // update(...).eq(...).select().single() -- item update
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: itemLookupSingle,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: itemUpdateSingle,
              }),
            }),
          }),
        }
      }
      if (table === 'leads') {
        return { update: updateLead }
      }
      if (table === 'follow_ups') {
        return { insert: followUpInsert, update: followUpUpdate }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { PATCH } from '../route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as never
}

describe('PATCH /api/dm-sessions/[id]/items/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    itemLookupResult = { data: { lead_id: 'lead-1' }, error: null }
    leadUpdateResult = { error: null }
    followUpInsertResult = { error: null }
    itemUpdateResult = {
      data: { id: 'item-1', outcome: 'archived', note: null, updated_at: '2026-08-27T00:00:00Z' },
      error: null,
    }
  })

  it('archives the lead when outcome is archived', async () => {
    const res = await PATCH(makeRequest({ outcome: 'archived' }), {
      params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.outcome).toBe('archived')
    expect(updateLead).toHaveBeenCalledWith({ status: 'dead' })
    expect(followUpUpdate).toHaveBeenCalledWith({ status: 'annule' })
  })

  it('creates a follow-up carrying the setter note when outcome is relaunched with a delay', async () => {
    itemUpdateResult = {
      data: { id: 'item-1', outcome: 'relaunched', note: 'Recontacter après vacances', updated_at: '2026-08-27T00:00:00Z' },
      error: null,
    }

    const res = await PATCH(
      makeRequest({ outcome: 'relaunched', delay_days: 7, note: 'Recontacter après vacances' }),
      { params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.outcome).toBe('relaunched')
    expect(followUpInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 'lead-1',
        channel: 'instagram_dm',
        status: 'en_attente',
        notes: 'Recontacter après vacances',
      })
    )
    // La relance en attente qui a rendu ce lead éligible à la session doit
    // être close, sinon il réapparaît indéfiniment en relance du jour / en retard.
    expect(followUpUpdate).toHaveBeenCalledWith({ status: 'fait' })
  })

  it('returns 500 and does not report success when the lead archive write fails', async () => {
    leadUpdateResult = { error: { message: 'RLS denied' } }

    const res = await PATCH(makeRequest({ outcome: 'archived' }), {
      params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.data).toBeUndefined()
    expect(itemUpdateSingle).not.toHaveBeenCalled()
  })

  it('returns 500 and does not report success when the follow-up insert fails', async () => {
    followUpInsertResult = { error: { message: 'insert failed' } }

    const res = await PATCH(makeRequest({ outcome: 'relaunched', delay_days: 7 }), {
      params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.data).toBeUndefined()
    expect(itemUpdateSingle).not.toHaveBeenCalled()
  })

  it('marks the conversation active and cancels pending follow-ups when outcome is replied', async () => {
    itemUpdateResult = {
      data: { id: 'item-1', outcome: 'replied', note: null, updated_at: '2026-08-27T00:00:00Z' },
      error: null,
    }

    const res = await PATCH(makeRequest({ outcome: 'replied' }), {
      params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.outcome).toBe('replied')
    expect(updateLead).toHaveBeenCalledWith(
      expect.objectContaining({ dm_conversation_active_at: expect.any(String) })
    )
    expect(followUpUpdate).toHaveBeenCalledWith({ status: 'annule' })
  })

  it('returns 500 and does not report success when marking the conversation active fails', async () => {
    leadUpdateResult = { error: { message: 'RLS denied' } }

    const res = await PATCH(makeRequest({ outcome: 'replied' }), {
      params: Promise.resolve({ id: 'session-1', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.data).toBeUndefined()
    expect(itemUpdateSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when the item does not belong to the session in the URL', async () => {
    itemLookupResult = { data: null, error: null }

    const res = await PATCH(makeRequest({ outcome: 'archived' }), {
      params: Promise.resolve({ id: 'wrong-session', itemId: 'item-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.data).toBeUndefined()
    expect(updateLead).not.toHaveBeenCalled()
  })
})
