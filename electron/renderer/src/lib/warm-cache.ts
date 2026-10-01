// Keeps the screens the coach uses fresh before they are opened. At start-up,
// and when the window comes back after a while, the most recently used reads
// are re-fetched in the background a few at a time: a click then shows
// current data at once, instead of last session's values followed by a jump.
// Live third-party reads (Meta Graph, AI, Instagram syncs) are left to the
// screens themselves.
import { revalidate, staleRecentKeys } from './query-cache'

const MAX_KEYS = 30
const CONCURRENCY = 3
const STALE_MS = 2 * 60_000
const REFOCUS_MS = 5 * 60_000
const SKIP = [/sync=true/, /refresh=true/, /^\/api\/ai\//, /^\/api\/meta\//, /^\/api\/storage\//]

let lastRun = 0

export async function warmCache(): Promise<void> {
  lastRun = Date.now()
  const keys = staleRecentKeys(MAX_KEYS * 2, STALE_MS)
    .filter((k) => !SKIP.some((re) => re.test(k)))
    .slice(0, MAX_KEYS)
  let next = 0
  const worker = async () => {
    while (next < keys.length) {
      const key = keys[next++]
      // A failed refresh keeps the cached value; the screen retries when opened.
      await revalidate(key).catch(() => undefined)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

/** Starts the warm-up shortly after the app shell mounts, and again on refocus. Returns a cleanup. */
export function startCacheWarming(): () => void {
  const timer = setTimeout(() => void warmCache(), 1500)
  const onFocus = () => {
    if (Date.now() - lastRun > REFOCUS_MS) void warmCache()
  }
  window.addEventListener('focus', onFocus)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', onFocus)
  }
}
