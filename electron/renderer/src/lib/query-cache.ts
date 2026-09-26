// Display cache for ClosRM Desktop — stale-while-revalidate over the ClosRM
// API. NOT a replica of Supabase and never a source of truth:
//  - keyed by API path, partitioned by the signed-in user (a workspace
//    belongs to one account here), so data never crosses accounts;
//  - holds only business data returned by the API (never tokens, cookies,
//    Instagram session, provider keys);
//  - bounded (LRU, MAX_ENTRIES, MAX_BYTES) and persisted to localStorage so
//    a relaunch shows the last known screens instantly;
//  - every read shows the cached value at once, then revalidates in the
//    background when older than `staleMs`; subscribers re-render only if
//    the server data actually changed.
import { api } from './api-client'

export interface CacheEntry<T = unknown> {
  data: T
  at: number
  /** Serialized data, used to skip re-renders when a refresh returns the same thing. */
  sig: string
}

const VERSION = 1
const MAX_ENTRIES = 150
const MAX_BYTES = 4_000_000
const STORAGE_PREFIX = `closrm:qc:v${VERSION}:`

let partition: string | null = null
let entries = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<() => void>>()
let persistTimer: ReturnType<typeof setTimeout> | null = null

// ─── metrics (dev) ───────────────────────────────────────────────────────
const DEV = import.meta.env.DEV

export function perfLog(screen: string, fields: Record<string, string | number | boolean>) {
  if (!DEV) return
  // Only durations/flags/counters — never data.
  console.info(`[perf] ${screen} ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ')}`)
}

// ─── partition ───────────────────────────────────────────────────────────
function storageKey(p: string) {
  return `${STORAGE_PREFIX}${p}`
}

/** Called on sign-in / sign-out. Switching account never exposes the previous one's data. */
export function setCachePartition(next: string | null) {
  if (next === partition) return
  flush()
  partition = next
  entries = new Map()
  inflight.clear()
  if (!next) return
  try {
    const raw = localStorage.getItem(storageKey(next))
    if (raw) {
      const parsed = JSON.parse(raw) as [string, CacheEntry][]
      entries = new Map(parsed)
    }
  } catch {
    entries = new Map()
  }
  for (const set of listeners.values()) set.forEach((fn) => fn())
}

/** Sign-out: drop this account's cache from memory and disk. */
export function clearCachePartition(p: string | null = partition) {
  if (!p) return
  try {
    localStorage.removeItem(storageKey(p))
  } catch {
    // ignore
  }
  if (p === partition) {
    entries = new Map()
    for (const set of listeners.values()) set.forEach((fn) => fn())
  }
}

function schedulePersist() {
  if (persistTimer) return
  persistTimer = setTimeout(flush, 1000)
}

function flush() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (!partition) return
  // Most recently used last → keep the tail within the budget.
  let list = [...entries.entries()].sort((a, b) => a[1].at - b[1].at).slice(-MAX_ENTRIES)
  let json = JSON.stringify(list)
  while (json.length > MAX_BYTES && list.length > 1) {
    list = list.slice(Math.ceil(list.length / 4))
    json = JSON.stringify(list)
  }
  try {
    localStorage.setItem(storageKey(partition), json)
  } catch {
    // quota / unavailable: memory cache still works
  }
}

// ─── core ────────────────────────────────────────────────────────────────
function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn())
}

export function subscribe(key: string, fn: () => void): () => void {
  const set = listeners.get(key) ?? new Set()
  set.add(fn)
  listeners.set(key, set)
  return () => {
    set.delete(fn)
    if (set.size === 0) listeners.delete(key)
  }
}

export function getCached<T>(key: string): CacheEntry<T> | undefined {
  return entries.get(key) as CacheEntry<T> | undefined
}

/** Writes a value (server response or optimistic update). Returns true if it changed. */
export function setCached<T>(key: string, data: T): boolean {
  const sig = JSON.stringify(data)
  const prev = entries.get(key)
  entries.delete(key) // re-insert = most recent
  entries.set(key, { data, at: Date.now(), sig })
  if (entries.size > MAX_ENTRIES * 1.2) {
    const oldest = [...entries.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, entries.size - MAX_ENTRIES)
    for (const [k] of oldest) entries.delete(k)
  }
  schedulePersist()
  const changed = !prev || prev.sig !== sig
  if (changed) notify(key)
  return changed
}

/** Optimistic update of a cached value; no-op if nothing is cached yet. */
export function updateCached<T>(key: string, updater: (prev: T) => T) {
  const prev = entries.get(key) as CacheEntry<T> | undefined
  if (prev) setCached(key, updater(prev.data))
}

/** Marks matching entries stale (they stay visible) and refetches the ones on screen. */
export function invalidate(match: string | ((key: string) => boolean)) {
  const test = typeof match === 'string' ? (k: string) => k.startsWith(match) : match
  for (const [k, e] of entries) {
    if (!test(k)) continue
    e.at = 0
    if (listeners.has(k)) void revalidate(k)
  }
}

/**
 * Fetches `key` (an API path by default, or any loader for composite screens),
 * deduplicating concurrent identical requests.
 */
export function revalidate<T>(key: string, fetcher?: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const t0 = performance.now()
  const p = (fetcher ? fetcher() : api.get<T>(key))
    .then((data) => {
      const changed = setCached(key, data)
      perfLog('api', { path: key.split('?')[0], ms: Math.round(performance.now() - t0), changed })
      return data
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function isStale(entry: CacheEntry | undefined, staleMs: number) {
  return !entry || Date.now() - entry.at > staleMs
}
