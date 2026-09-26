// The coach's Instagram account used by every Hiker feature — asked once
// after login (InstagramOnboarding), shown in the top bar, editable there.
// Backed by GET/PUT /api/instagram/target-account.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api-client'

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
  const [account, setAccount] = useState<TargetAccount | null | undefined>(undefined)
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
    try {
      const res = await api.get<{ data: TargetAccount | null }>('/api/instagram/target-account')
      setAccount(res.data)
    } catch {
      setAccount(null)
    }
  }, [])

  const save = useCallback(async (username: string) => {
    const res = await api.put<{ data: TargetAccount }>('/api/instagram/target-account', { username })
    setAccount(res.data)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <Ctx.Provider value={{ account, skipped, skip, save, reload }}>{children}</Ctx.Provider>
}

export function useInstagramAccount(): InstagramAccountValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useInstagramAccount must be used inside InstagramAccountProvider')
  return v
}
