import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('../api-client', () => ({ api: { get: (...a: unknown[]) => get(...a) }, ApiError: class extends Error {} }))

import { clearCachePartition, getCached, invalidate, registerLoader, revalidate, setCachePartition, setCached, staleRecentKeys, subscribe, swrMany, updateCached } from '../query-cache'

beforeEach(() => {
  localStorage.clear()
  get.mockReset()
  setCachePartition(null)
})

describe('query-cache', () => {
  it('isolates data per account partition', () => {
    setCachePartition('user-a')
    setCached('/api/leads', ['a'])
    setCachePartition('user-b')
    expect(getCached('/api/leads')).toBeUndefined()
    setCached('/api/leads', ['b'])
    setCachePartition('user-a')
    expect(getCached<string[]>('/api/leads')?.data).toEqual(['a'])
  })

  it('persists across a reload of the same partition and clears on sign-out', async () => {
    setCachePartition('user-a')
    setCached('/api/leads', ['a'])
    setCachePartition('user-b') // flushes user-a
    setCachePartition('user-a')
    expect(getCached<string[]>('/api/leads')?.data).toEqual(['a'])
    clearCachePartition('user-a')
    expect(getCached('/api/leads')).toBeUndefined()
  })

  it('notifies subscribers only when data actually changes', () => {
    setCachePartition('u')
    const fn = vi.fn()
    subscribe('/k', fn)
    setCached('/k', { a: 1 })
    setCached('/k', { a: 1 })
    setCached('/k', { a: 2 })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent identical requests', async () => {
    setCachePartition('u')
    get.mockResolvedValue({ ok: true })
    await Promise.all([revalidate('/x'), revalidate('/x')])
    expect(get).toHaveBeenCalledTimes(1)
    expect(getCached('/x')?.data).toEqual({ ok: true })
  })

  it('applies optimistic updates and invalidates by prefix', () => {
    setCachePartition('u')
    setCached('/api/leads/1', { status: 'nouveau' })
    updateCached<{ status: string }>('/api/leads/1', (p) => ({ ...p, status: 'clos' }))
    expect(getCached<{ status: string }>('/api/leads/1')?.data.status).toBe('clos')
    invalidate('/api/leads')
    expect(getCached('/api/leads/1')?.at).toBe(0)
  })

  it('composite keys: a registered loader refreshes them before the screen exists; unknown ones never hit the API', async () => {
    setCachePartition('u')
    registerLoader('desktop:test:', (key) => () => Promise.resolve({ from: key }))
    await expect(revalidate('desktop:test:30')).resolves.toEqual({ from: 'desktop:test:30' })
    expect(getCached('desktop:test:30')?.data).toEqual({ from: 'desktop:test:30' })
    await expect(revalidate('desktop:nobody')).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('invalidate refreshes an on-screen composite key with its own loader', async () => {
    setCachePartition('u')
    let n = 0
    await revalidate('desktop:mine', () => Promise.resolve(++n))
    subscribe('desktop:mine', () => {})
    invalidate('desktop:mine')
    await new Promise((r) => setTimeout(r, 0))
    expect(getCached('desktop:mine')?.data).toBe(2)
    expect(get).not.toHaveBeenCalled()
  })

  it('swrMany: cached values at once when all are cached, then the fresh ones', async () => {
    setCachePartition('u')
    setCached('/a', 1)
    setCached('/b', 2)
    get.mockImplementation((k: string) => Promise.resolve(k === '/a' ? 10 : 2))
    const seen: number[][] = []
    await swrMany<[number, number]>(['/a', '/b'], (v) => seen.push(v))
    expect(seen).toEqual([
      [1, 2],
      [10, 2],
    ])
  })

  it('staleRecentKeys: only stale entries, most recently used first', async () => {
    setCachePartition('stale-keys')
    setCached('/old', 1)
    setCached('/new', 2)
    const old = getCached('/old')
    const recent = getCached('/new')
    if (old) old.at = Date.now() - 600_000
    if (recent) recent.at = Date.now() - 300_000
    setCached('/fresh', 3)
    expect(staleRecentKeys(10, 60_000)).toEqual(['/new', '/old'])
  })
})
