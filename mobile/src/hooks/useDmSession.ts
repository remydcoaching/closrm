import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface DmSessionItem {
  id: string
  lead_id: string
  position: number
  category: string
  outcome: 'relaunched' | 'archived' | 'skipped' | null
  note: string | null
}

export interface DmSessionDetail {
  id: string
  status: 'active' | 'completed' | 'abandoned'
  target_count: number
  items: DmSessionItem[]
}

export function useDmSessionEntry() {
  const [eligibleCount, setEligibleCount] = useState(0)
  const [activeSession, setActiveSession] = useState<{ id: string; doneCount: number; targetCount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get<{ data: DmSessionDetail | null }>('/api/dm-sessions').then(({ data }) => {
      if (cancelled) return
      if (data) {
        setActiveSession({
          id: data.id,
          doneCount: data.items.filter((i) => i.outcome !== null).length,
          targetCount: data.target_count,
        })
      } else {
        setActiveSession(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { eligibleCount, activeSession, loading }
}

export function useStartDmSession() {
  return useCallback(async (config: { targetCount: number; staleThresholdDays: number }) => {
    const { data } = await api.post<{ data: { id: string } }>('/api/dm-sessions', {
      target_count: config.targetCount,
      stale_threshold_days: config.staleThresholdDays,
    })
    return data
  }, [])
}

export function useDmSession(sessionId: string | null) {
  const [session, setSession] = useState<DmSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    const { data } = await api.get<{ data: DmSessionDetail }>(`/api/dm-sessions/${sessionId}`)
    setSession(data)
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const currentItem = session?.items.find((i) => i.outcome === null) ?? null

  const submitOutcome = useCallback(
    async (itemId: string, outcome: 'relaunched' | 'archived' | 'skipped', opts?: { note?: string; delayDays?: number }) => {
      await api.patch(`/api/dm-sessions/${sessionId}/items/${itemId}`, {
        outcome,
        ...(opts?.note ? { note: opts.note } : {}),
        ...(opts?.delayDays ? { delay_days: opts.delayDays } : {}),
      })
      await refetch()
    },
    [sessionId, refetch]
  )

  return { session, currentItem, loading, submitOutcome }
}
