import { renderHook, waitFor, act } from '@testing-library/react-native'

jest.mock('../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}))

import { useDmSessionEntry, useDmSession } from '../useDmSession'
import { api } from '../../services/api'

const mockGet = api.get as jest.Mock
const mockPost = api.post as jest.Mock
const mockPatch = api.patch as jest.Mock

describe('useDmSessionEntry', () => {
  it('returns eligibleCount and null activeSession when no session is active', async () => {
    mockGet.mockResolvedValueOnce({ data: null })
    const { result } = await renderHook(() => useDmSessionEntry())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeSession).toBeNull()
  })
})

describe('useDmSession', () => {
  it('exposes the current (first unresolved) item and lets outcome be submitted', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        items: [
          { id: 'item-1', lead_id: 'lead-1', position: 0, outcome: null },
          { id: 'item-2', lead_id: 'lead-2', position: 1, outcome: null },
        ],
      },
    })
    mockPatch.mockResolvedValueOnce({ data: { id: 'item-1', outcome: 'relaunched' } })

    const { result } = await renderHook(() => useDmSession('session-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.currentItem?.id).toBe('item-1')

    // submitOutcome calls refetch() after the PATCH — a second api.get mock
    // is required or the hook receives `undefined` on its post-submit refetch.
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        items: [
          { id: 'item-1', lead_id: 'lead-1', position: 0, outcome: 'relaunched' },
          { id: 'item-2', lead_id: 'lead-2', position: 1, outcome: null },
        ],
      },
    })

    await act(async () => {
      await result.current.submitOutcome('item-1', 'relaunched', { delayDays: 7 })
    })
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/dm-sessions/session-1/items/item-1',
      { outcome: 'relaunched', delay_days: 7 }
    )
  })
})
