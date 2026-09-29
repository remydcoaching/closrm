// The coach's Instagram account used by every Hiker feature — asked once
// after login (InstagramOnboarding), shown in the top bar, editable there.
// Backed by GET/PUT /api/instagram/target-account.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api } from './api-client'
import { setCached } from './query-cache'
import { useCachedQuery } from './use-cached-query'

export interface TargetAccount {
  username: string
  source: 'workspace' | 'meta' | 'last_scan'
}

const SKIP_KEY = 'closrm:instagram-onboarding:skipped'

interface InstagramAccountValue {
  /** undefined = loading, null = none known yet. */
  account: TargetAccount | null | undefined
  /** The coach chose "Faire plus tard" on the onboarding. */
  skipped: boolean
  skip: () => void
  save: (username: string) => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<InstagramAccountValue | null>(null)

export function InstagramAccountProvider({ children }: { children: ReactNode }) {
  // Cache first: the header and onboarding decision render instantly on launch.
  const query = useCachedQuery<{ data: TargetAccount | null }>('/api/instagram/target-account', { screen: 'TargetAccount', staleMs: 10 * 60_000 })
  const account: TargetAccount | null | undefined = query.data ? query.data.data : query.error ? null : undefined

  const [skipped, setSkipped] = useState(() => {
    try {
      return localStorage.getItem(SKIP_KEY) === '1'
    } catch {
      return false
    }
  })

  const skip = useCallback(() => {
    setSkipped(true)
    try {
      localStorage.setItem(SKIP_KEY, '1')
    } catch {
      // per-session only if storage is unavailable
    }
  }, [])

  const reload = useCallback(async () => {
    await query.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(async (username: string) => {
    const res = await api.put<{ data: TargetAccount }>('/api/instagram/target-account', { username })
    setCached('/api/instagram/target-account', { data: res.data })
  }, [])

  return <Ctx.Provider value={{ account, skipped, skip, save, reload }}>{children}</Ctx.Provider>
}

export function useInstagramAccount(): InstagramAccountValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useInstagramAccount must be used inside InstagramAccountProvider')
  return v
}
