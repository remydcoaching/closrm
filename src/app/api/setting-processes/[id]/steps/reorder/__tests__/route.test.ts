import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/get-workspace', () => ({
  getWorkspaceId: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'admin' }),
}))

const STEP_1 = '11111111-1111-4111-8111-111111111111'
const STEP_2 = '22222222-2222-4222-8222-222222222222'
const OTHER_PROCESS_STEP = '99999999-9999-4999-8999-999999999999'

let processLookupResult: { data: { id: string } | null }
let existingStepsResult: { data: { id: string }[] }
let finalStepsResult: { data: unknown[] }

const stepUpdateEq2 = vi.fn(() => Promise.resolve({ error: null }))
const stepUpdate = vi.fn(() => ({ eq: () => ({ eq: stepUpdateEq2 }) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === 'setting_processes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => Promise.resolve(processLookupResult)),
        }
      }
      if (table === 'setting_process_steps') {
        return {
          // First call: select('id').eq(...) -- awaited directly, no .order().
          // Second call: select('*, transitions...').eq(...).order(...).
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              then: (resolve: (v: typeof existingStepsResult) => void) => resolve(existingStepsResult),
              order: vi.fn(() => Promise.resolve(finalStepsResult)),
            })),
          })),
          update: stepUpdate,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { PUT } from '../route'

function makeRequest(body: unknown) {
  return new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }) as never
}

describe('PUT /api/setting-processes/[id]/steps/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    processLookupResult = { data: { id: 'process-1' } }
    existingStepsResult = { data: [{ id: STEP_1 }, { id: STEP_2 }] }
    finalStepsResult = { data: [{ id: STEP_2, position: 0 }, { id: STEP_1, position: 1 }] }
  })

  it('updates each step position and returns the reordered list', async () => {
    const res = await PUT(
      makeRequest([{ id: STEP_2, position: 0 }, { id: STEP_1, position: 1 }]),
      { params: Promise.resolve({ id: 'process-1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(stepUpdate).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }))
    expect(stepUpdate).toHaveBeenCalledWith(expect.objectContaining({ position: 1 }))
    expect(body.data).toEqual(finalStepsResult.data)
  })

  it('rejects a step id that does not belong to this process', async () => {
    const res = await PUT(
      makeRequest([{ id: OTHER_PROCESS_STEP, position: 0 }]),
      { params: Promise.resolve({ id: 'process-1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(stepUpdate).not.toHaveBeenCalled()
    expect(body.error).toBeDefined()
  })

  it('404s when the process does not belong to the workspace', async () => {
    processLookupResult = { data: null }

    const res = await PUT(
      makeRequest([{ id: STEP_1, position: 0 }]),
      { params: Promise.resolve({ id: 'process-1' }) }
    )

    expect(res.status).toBe(404)
  })
})
