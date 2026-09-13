import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'

export interface DmSessionLead {
  id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  instagram_user_id: string | null
  status: string
  last_activity_at: string | null
}

export interface DmSessionStepTransition {
  outcome_label: string
  target_step_id: string
}

export interface DmSessionNextStepPreview {
  title: string
  delay_days: number | null
}

export interface DmSessionRelanceStepOption {
  step_id: string
  title: string
  delay_days: number | null
}

export interface DmSessionTemplate {
  label: string
  text: string
  process_id: string | null
  step_id: string | null
  next_step_id: string | null
  delay_days: number | null
  transitions: DmSessionStepTransition[]
  next_step: DmSessionNextStepPreview | null
  relance_step_options: DmSessionRelanceStepOption[]
}

export type DmSessionItemOutcome = 'relaunched' | 'archived' | 'skipped' | 'replied'

export interface DmSessionItem {
  id: string
  lead_id: string
  position: number
  category: string
  outcome: DmSessionItemOutcome | null
  note: string | null
  lead: DmSessionLead
  // Le backend ne calcule le template que pour les items non traités
  // (outcome === null) — absent une fois l'item clos.
  template?: DmSessionTemplate
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
  return useCallback(
    async (config: {
      targetCount: number
      staleThresholdDays: number
      relanceEnRetard: boolean
      premierContact: boolean
      jamaisRecontacte: boolean
    }) => {
      const { data } = await api.post<{ data: { id: string } }>('/api/dm-sessions', {
        target_count: config.targetCount,
        stale_threshold_days: config.staleThresholdDays,
        relance_en_retard: config.relanceEnRetard,
        premier_contact: config.premierContact,
        jamais_recontacte: config.jamaisRecontacte,
      })
      return data
    },
    []
  )
}

export function useDmSession(sessionId: string | null) {
  const [session, setSession] = useState<DmSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!sessionId) return
    setError(null)
    try {
      const { data } = await api.get<{ data: DmSessionDetail }>(`/api/dm-sessions/${sessionId}`)
      setSession(data)
    } catch {
      setError('Impossible de charger la session.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refetch()
  }, [refetch])

  const currentItem = session?.items.find((i) => i.outcome === null) ?? null

  const submitOutcome = useCallback(
    async (itemId: string, outcome: DmSessionItemOutcome, opts?: { note?: string; delayDays?: number }) => {
      await api.patch(`/api/dm-sessions/${sessionId}/items/${itemId}`, {
        outcome,
        ...(opts?.note ? { note: opts.note } : {}),
        ...(opts?.delayDays ? { delay_days: opts.delayDays } : {}),
      })
      await refetch()
    },
    [sessionId, refetch]
  )

  const abandon = useCallback(async () => {
    if (!sessionId) return
    await api.patch(`/api/dm-sessions/${sessionId}`, { status: 'abandoned' })
  }, [sessionId])

  return { session, currentItem, loading, error, submitOutcome, refetch, abandon }
}
