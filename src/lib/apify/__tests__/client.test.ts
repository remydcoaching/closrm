import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startLikersRun, getRunStatus, getDatasetItems } from '../client'

const originalFetch = global.fetch

describe('apify client', () => {
  beforeEach(() => {
    process.env.APIFY_API_TOKEN = 'test-token'
    process.env.APIFY_ACTOR_ID = 'test-actor-id'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('startLikersRun posts to the actor runs endpoint with the token and post URLs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'run-123', defaultDatasetId: 'dataset-456' } }),
    })
    global.fetch = mockFetch as unknown as typeof fetch

    const result = await startLikersRun(['https://www.instagram.com/reel/abc/'])

    expect(result).toEqual({ runId: 'run-123', datasetId: 'dataset-456' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.apify.com/v2/actors/test-actor-id/runs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('startLikersRun throws when the API responds with an error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }) as unknown as typeof fetch

    await expect(startLikersRun(['https://www.instagram.com/reel/abc/'])).rejects.toThrow(
      'Apify run start failed: 401',
    )
  })

  it('getRunStatus fetches the run and returns status + dataset id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'SUCCEEDED', defaultDatasetId: 'dataset-456' } }),
    }) as unknown as typeof fetch

    const result = await getRunStatus('run-123')

    expect(result).toEqual({ status: 'SUCCEEDED', defaultDatasetId: 'dataset-456' })
  })

  it('getDatasetItems fetches and returns the items array', async () => {
    const items = [
      { position: 1, userId: 'u1', username: 'user_one', fullName: 'User One', profilePicUrl: null, isVerified: false, sourcePost: 'https://www.instagram.com/reel/abc/', scrapedAt: '2026-08-21T10:00:00.000Z' },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items }),
    }) as unknown as typeof fetch

    const result = await getDatasetItems('dataset-456')

    expect(result).toEqual(items)
  })
})
