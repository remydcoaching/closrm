import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('../api-client', () => ({ api: { get: (...a: unknown[]) => get(...a) }, ApiError: class extends Error {} }))

import { clearCachePartition, getCached, invalidate, revalidate, setCachePartition, setCached, subscribe, updateCached } from '../query-cache'

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
})
