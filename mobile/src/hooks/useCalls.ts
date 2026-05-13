import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Call, Lead } from '@shared/types'

export interface CallWithLead extends Call {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'status' | 'deal_amount'> | null
}

const startOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function useCalls(date: Date) {
  const [calls, setCalls] = useState<CallWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = startOfDay(date).toISOString()
    const to = endOfDay(date).toISOString()
    const { data, error: e } = await supabase
      .from('calls')
      .select('*, lead:leads(id, first_name, last_name, status, deal_amount)')
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at', { ascending: true })
    if (e) {
      setError(e.message)
      setCalls([])
    } else {
      setCalls((data as unknown as CallWithLead[]) ?? [])
    }
    setLoading(false)
  }, [date])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Subscription temps réel sur calls (refetch global du jour).
  useEffect(() => {
    const channel = supabase
      .channel('calls-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        void fetch()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetch])

  return { calls, loading, error, refetch: fetch }
}
