import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Lead } from '@shared/types'

export function useLead(leadId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!leadId) {
      setLead(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()
    if (e) setError(e.message)
    else setLead((data as Lead | null) ?? null)
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Subscription ciblée : ne re-fetch que si CE lead change.
  useEffect(() => {
    if (!leadId) return
    const channel = supabase
      .channel(`lead-${leadId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` },
        () => {
          void fetch()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leadId, fetch])

  return { lead, loading, error, refetch: fetch }
}
