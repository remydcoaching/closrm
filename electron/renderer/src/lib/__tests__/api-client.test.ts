import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from '../supabase'
import { api, ApiError } from '../api-client'

const originalFetch = global.fetch

function mockSession(token: string | null) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: token ? ({ access_token: token } as never) : null },
    error: null,
  } as never)
}

describe('api-client', () => {
  beforeEach(() => {
    mockSession('test-access-token')
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('attaches Authorization: Bearer <token> from the current Supabase session', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) })
    global.fetch = mockFetch as unknown as typeof fetch

    await api.get('/api/leads')

    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-access-token' })
  })

  it('sends no Authorization header when there is no session', async () => {
    mockSession(null)
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) })
    global.fetch = mockFetch as unknown as typeof fetch

    await api.get('/api/leads')

    const [, init] = mockFetch.mock.calls[0]
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization')
  })

  it('throws ApiError(401) on an unauthenticated/expired-session response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) }) as unknown as typeof fetch

    await expect(api.get('/api/leads')).rejects.toMatchObject({ status: 401 })
  })

  it('throws ApiError with the server message on other non-2xx responses', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Erreur serveur' }) }) as unknown as typeof fetch

    await expect(api.get('/api/leads')).rejects.toMatchObject({ status: 500, message: 'Erreur serveur' })
  })

  it('never logs or exposes the access token anywhere other than the request header', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }) as unknown as typeof fetch

    await api.post('/api/leads', { first_name: 'Test' })

    const allLogs = [...consoleSpy.mock.calls, ...consoleErrSpy.mock.calls].flat().join(' ')
    expect(allLogs).not.toContain('test-access-token')
    consoleSpy.mockRestore()
    consoleErrSpy.mockRestore()
  })

  it('is an instance of ApiError with status and message on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }) as unknown as typeof fetch

    try {
      await api.get('/api/leads')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(403)
    }
  })

  it('reads carry a timeout signal (a stuck server ends in ApiError 408, not an endless spinner); writes do not', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    global.fetch = mockFetch as unknown as typeof fetch
    await api.get('/api/leads')
    await api.post('/api/instagram/monitor', {})
    expect((mockFetch.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
    expect((mockFetch.mock.calls[1][1] as RequestInit).signal).toBeUndefined()

    global.fetch = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')) as unknown as typeof fetch
    await expect(api.get('/api/leads')).rejects.toMatchObject({ status: 408 })
  })
})
