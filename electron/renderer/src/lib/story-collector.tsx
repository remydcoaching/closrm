// Background collection of the coach's own story viewers while the app is
// open (stories — and their viewer lists — disappear after 24h, so they must
// be read while live). Talks to the main process through
// window.closrm.instagram (the Instagram session never reaches the renderer)
// and pushes parsed viewers to POST /api/instagram/story-views.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from './api-client'
import type { CollectStoriesResult, InstagramSessionStatus } from './electron-bridge'

const INTERVAL_MS = 30 * 60_000
const BACKOFF_MS = 6 * 60 * 60_000
const LAST_RUN_KEY = 'closrm:story-collector:last-run'
const PAUSED_UNTIL_KEY = 'closrm:story-collector:paused-until'

export interface CollectorRun {
  at: string
  ok: boolean
  stories: number
  viewers: number
  leadsMatched: number
  message: string | null
}

interface StoryCollectorValue {
  available: boolean
  status: InstagramSessionStatus | null
  collecting: boolean
  lastRun: CollectorRun | null
  pausedUntil: number | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  collectNow: () => Promise<void>
}

const Ctx = createContext<StoryCollectorValue | null>(null)

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable: collection still works, just not remembered
  }
}

const FAILURE_MESSAGE: Record<string, string> = {
  not_connected: 'Session Instagram déconnectée — reconnectez-vous.',
  checkpoint: 'Instagram demande une vérification : ouvrez Instagram, validez, puis reconnectez la session. Collecte en pause 6 h.',
  rate_limited: 'Instagram limite les requêtes. Collecte en pause 6 h.',
  error: 'La collecte a échoué.',
}

export function StoryCollectorProvider({ children }: { children: ReactNode }) {
  const bridge = typeof window !== 'undefined' ? window.closrm?.instagram : undefined
  const [status, setStatus] = useState<InstagramSessionStatus | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [lastRun, setLastRun] = useState<CollectorRun | null>(() => readJson<CollectorRun>(LAST_RUN_KEY))
  const [pausedUntil, setPausedUntil] = useState<number | null>(() => readJson<number>(PAUSED_UNTIL_KEY))
  const running = useRef(false)

  const record = useCallback((run: CollectorRun) => {
    setLastRun(run)
    writeJson(LAST_RUN_KEY, run)
  }, [])

  const collectNow = useCallback(async () => {
    if (!bridge || running.current) return
    running.current = true
    setCollecting(true)
    try {
      const result: CollectStoriesResult = await bridge.collectStories()
      if (!result.ok) {
        if (result.reason === 'checkpoint' || result.reason === 'rate_limited') {
          const until = Date.now() + BACKOFF_MS
          setPausedUntil(until)
          writeJson(PAUSED_UNTIL_KEY, until)
        }
        if (result.reason === 'not_connected') setStatus({ connected: false, userId: null, username: null })
        record({ at: new Date().toISOString(), ok: false, stories: 0, viewers: 0, leadsMatched: 0, message: FAILURE_MESSAGE[result.reason] ?? result.message })
        return
      }
      setPausedUntil(null)
      writeJson(PAUSED_UNTIL_KEY, null)
      if (result.stories.length === 0) {
        record({ at: new Date().toISOString(), ok: true, stories: 0, viewers: 0, leadsMatched: 0, message: 'Aucune story en ligne en ce moment.' })
        return
      }
      const res = await api.post<{ data: { stories: number; viewers: number; leadsMatched: number; errors: string[] } }>('/api/instagram/story-views', {
        accountUsername: result.accountUsername,
        stories: result.stories,
      })
      record({
        at: new Date().toISOString(),
        ok: res.data.errors.length === 0,
        stories: res.data.stories,
        viewers: res.data.viewers,
        leadsMatched: res.data.leadsMatched,
        message: res.data.errors.length > 0 ? `Enregistrement partiel : ${res.data.errors[0]}` : null,
      })
    } catch (err) {
      record({ at: new Date().toISOString(), ok: false, stories: 0, viewers: 0, leadsMatched: 0, message: err instanceof Error ? err.message : 'La collecte a échoué.' })
    } finally {
      running.current = false
      setCollecting(false)
    }
  }, [bridge, record])

  useEffect(() => {
    bridge?.status().then(setStatus).catch(() => setStatus({ connected: false, userId: null, username: null }))
  }, [bridge])

  // Auto-collect: right away if the last run is older than the interval,
  // then every INTERVAL_MS — unless paused after a challenge/rate limit.
  useEffect(() => {
    if (!status?.connected) return
    const tick = () => {
      const paused = readJson<number>(PAUSED_UNTIL_KEY)
      if (paused && paused > Date.now()) return
      const last = readJson<CollectorRun>(LAST_RUN_KEY)
      if (!last || Date.now() - new Date(last.at).getTime() >= INTERVAL_MS - 60_000) collectNow()
    }
    tick()
    const id = setInterval(tick, INTERVAL_MS)
    return () => clearInterval(id)
  }, [status?.connected, collectNow])

  const connect = useCallback(async () => {
    if (!bridge) return
    const s = await bridge.login()
    setStatus(s)
    if (s.connected) {
      setPausedUntil(null)
      writeJson(PAUSED_UNTIL_KEY, null)
    }
  }, [bridge])

  const disconnect = useCallback(async () => {
    if (!bridge) return
    await bridge.logout()
    setStatus({ connected: false, userId: null, username: null })
  }, [bridge])

  return (
    <Ctx.Provider value={{ available: !!bridge, status, collecting, lastRun, pausedUntil, connect, disconnect, collectNow }}>{children}</Ctx.Provider>
  )
}

export function useStoryCollector(): StoryCollectorValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStoryCollector must be used inside StoryCollectorProvider')
  return v
}
