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

  return { call, loading, error, refetch: fetch }
}
