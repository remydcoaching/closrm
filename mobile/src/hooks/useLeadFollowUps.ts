import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

export interface LeadFollowUp {
  id: string
  reason: string
  scheduled_at: string
  channel: string
  status: string
  notes: string | null
  created_at: string
}

export function useLeadFollowUps(leadId: string) {
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFollowUps = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('follow_ups')
      .select('id, reason, scheduled_at, channel, status, notes, created_at')
      .eq('lead_id', leadId)
      .order('scheduled_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setFollowUps([])
    } else {
      setFollowUps((data ?? []) as LeadFollowUp[])
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    void fetchFollowUps()
  }, [fetchFollowUps])

  useEffect(() => {
    const channel = supabase
      .channel(`lead-follow-ups-${leadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_ups', filter: `lead_id=eq.${leadId}` },
        () => void fetchFollowUps(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leadId, fetchFollowUps])

  return { followUps, loading, error, refetch: fetchFollowUps }
}
