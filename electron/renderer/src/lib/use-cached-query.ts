// React binding for query-cache: cache first, background refresh.
//   const { data, error, loading, refreshing, refresh } = useCachedQuery<T>('/api/…')
// `loading` is true only when there is nothing to show yet (first visit);
// revisits render the cached value immediately while `refreshing`.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError } from './api-client'
import { getCached, isStale, perfLog, revalidate, subscribe } from './query-cache'

export interface CachedQuery<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
}

export function useCachedQuery<T>(
  key: string | null,
  opts: { staleMs?: number; screen?: string; fetcher?: () => Promise<T>; keepPrevious?: boolean } = {},
): CachedQuery<T> {
  const fetcherRef = useRef(opts.fetcher)
  fetcherRef.current = opts.fetcher
  const staleMs = opts.staleMs ?? 15_000
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const mountedAt = useRef(performance.now())

  const entry = useSyncExternalStore(
    useCallback((fn) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? getCached<T>(key) : undefined),
  )

  const refresh = useCallback(async () => {
    if (!key) return
    setRefreshing(true)
    const t0 = performance.now()
    try {
      await revalidate<T>(key, fetcherRef.current)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    } finally {
      setRefreshing(false)
      if (opts.screen) perfLog(opts.screen, { refresh_ms: Math.round(performance.now() - t0) })
    }
  }, [key, opts.screen])

  useEffect(() => {
    if (!key) return
    mountedAt.current = performance.now()
    const current = getCached<T>(key)
    if (opts.screen) perfLog(opts.screen, { cache_hit: !!current, age_s: current ? Math.round((Date.now() - current.at) / 1000) : -1 })
    if (isStale(current, staleMs)) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Time to first useful render (cached or fetched).
  const logged = useRef<string | null>(null)
  useEffect(() => {
    if (entry && opts.screen && logged.current !== key) {
      logged.current = key
      perfLog(opts.screen, { first_data_ms: Math.round(performance.now() - mountedAt.current) })
    }
  }, [entry, key, opts.screen])

  // keepPrevious: while a new key (page, filter) loads, keep showing the last data.
  const lastData = useRef<T | undefined>(undefined)
  if (entry) lastData.current = entry.data
  const shown = entry?.data ?? (opts.keepPrevious ? lastData.current : undefined)

  return {
    data: shown,
    error: shown !== undefined ? null : error,
    loading: shown === undefined && !error,
    refreshing,
    refresh,
  }
}
