import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { HikerClient } from '../client'
import { HikerApiError } from '../errors'
import {
  fixtureProfile,
  fixtureMediaChunkPage,
  makeMediaItem,
  fixtureLikersResponse,
  fixtureLiker,
  fixtureCommentsResponse,
  fixtureFollowersResponse,
  fixtureInsufficientFundsBody,
  fixtureNotFoundBody,
} from './fixtures/responses'

const originalFetch = global.fetch

function jsonResponse(status: number, body: unknown) {
  return { status, text: () => Promise.resolve(JSON.stringify(body)) } as Response
}

describe('HikerClient', () => {
  beforeEach(() => {
    process.env.HIKER_API_KEY = 'test-key-not-real'
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
    delete process.env.HIKER_API_KEY
  })

  it('throws if no API key is available anywhere', () => {
    delete process.env.HIKER_API_KEY
    expect(() => new HikerClient()).toThrow(/HIKER_API_KEY/)
  })

  it('never includes the API key in a request URL — only in the header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, fixtureProfile))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = new HikerClient({ apiKey: 'super-secret-key' })
    await client.getUserByUsername('test_account')

    const [url, init] = mockFetch.mock.calls[0]
    expect(String(url)).not.toContain('super-secret-key')
    expect((init as RequestInit).headers).toMatchObject({ 'x-access-key': 'super-secret-key' })
  })

  it('resolves a username to a profile on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, fixtureProfile)) as unknown as typeof fetch
    const client = new HikerClient()
    const profile = await client.getUserByUsername('test_account')
    expect(profile.pk).toBe(1000000001)
  })

  it('classifies 402 as INSUFFICIENT_FUNDS and throws without retrying', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(402, fixtureInsufficientFundsBody))
    global.fetch = mockFetch as unknown as typeof fetch
    const client = new HikerClient()

    await expect(client.getUserByUsername('test_account')).rejects.toMatchObject({ category: 'INSUFFICIENT_FUNDS' })
    expect(mockFetch).toHaveBeenCalledTimes(1) // no retry on a definitive error
  })

  it('classifies 404 as NOT_FOUND on comments without throwing (per-content, non-fatal)', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(404, fixtureNotFoundBody)) as unknown as typeof fetch
    const client = new HikerClient()
    const result = await client.getMediaCommentsPage('123', null)
    expect(result.status).toBe(404)
    expect(result.category).toBe('NOT_FOUND')
    expect(result.comments).toEqual([])
  })

  it('retries on 429 with backoff, then succeeds', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(jsonResponse(200, fixtureProfile))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = new HikerClient({ maxRetries: 2 })
    const profile = await client.getUserByUsername('test_account')
    expect(profile.pk).toBe(1000000001)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxRetries on persistent 500 errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'server error' }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = new HikerClient({ maxRetries: 1 })
    await expect(client.getUserByUsername('test_account')).rejects.toBeInstanceOf(HikerApiError)
    expect(mockFetch).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
  })

  it('paginates media chunks following the returned cursor until null', async () => {
    const page1 = fixtureMediaChunkPage([makeMediaItem({ pk: 1 })], 'cursor-2')
    const page2 = fixtureMediaChunkPage([makeMediaItem({ pk: 2 })], null)
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, page1))
      .mockResolvedValueOnce(jsonResponse(200, page2))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = new HikerClient()
    const first = await client.getUserMediaChunkPage('1000000001', null)
    expect(first.nextCursor).toBe('cursor-2')
    const second = await client.getUserMediaChunkPage('1000000001', first.nextCursor)
    expect(second.nextCursor).toBeNull()

    expect(mockFetch.mock.calls[1][0]).toContain('end_cursor=cursor-2')
  })

  it('returns likers wrapped in { users } shape, not a bare array', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, fixtureLikersResponse([fixtureLiker]))) as unknown as typeof fetch
    const client = new HikerClient()
    const result = await client.getMediaLikers('123')
    expect(result.users).toHaveLength(1)
    expect(result.users[0].username).toBe('liker_one')
  })

  it('paginates followers via page_id until next_page_id is null', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, fixtureFollowersResponse([fixtureLiker], 'page-2')))
      .mockResolvedValueOnce(jsonResponse(200, fixtureFollowersResponse([fixtureLiker], null)))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = new HikerClient()
    const page1 = await client.getFollowersPage('1000000001', null)
    expect(page1.nextPageId).toBe('page-2')
    const page2 = await client.getFollowersPage('1000000001', page1.nextPageId)
    expect(page2.nextPageId).toBeNull()
  })

  it('paginates comments via page_id and stops when next_page_id is null', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, fixtureCommentsResponse([{ pk: 'c1', user: fixtureLiker, text: 'hi' }], null))) as unknown as typeof fetch
    const client = new HikerClient()
    const result = await client.getMediaCommentsPage('123', null)
    expect(result.comments).toHaveLength(1)
    expect(result.nextPageId).toBeNull()
  })
})
