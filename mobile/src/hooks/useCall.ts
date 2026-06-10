import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { CallWithLead } from './useCalls'

export function useCall(callId: string | null) {
  const [call, setCall] = useState<CallWithLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!callId) {
      setCall(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('calls')
      .select('*, lead:leads(id, first_name, last_name, status, deal_amount)')
      .eq('id', callId)
      .maybeSingle()
    if (e) setError(e.message)
    else setCall((data as unknown as CallWithLead | null) ?? null)
    setLoading(false)
  }, [callId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Subscription temps réel ciblée : si CE call est mis à jour côté
  // backend (notes auto-save concurrente, status passé à done…), on
  // refetch. Évite que CallDetailScreen reste bloqué sur un état stale.
  useEffect(() => {
    if (!callId) return
    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        () => {
          void fetch()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [callId, fetch])

  return { call, loading, error, refetch: fetch }
}
