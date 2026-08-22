import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Lead } from '@shared/types'

export type FollowUpTab = 'today' | 'overdue' | 'upcoming' | 'done'

export interface FollowUpWithLead {
  id: string
  lead_id: string
  reason: string
  scheduled_at: string
  channel: string
  status: string
  notes: string | null
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'>
}

export function useFollowUps(tab: FollowUpTab) {
  const [followUps, setFollowUps] = useState<FollowUpWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFollowUps = useCallback(async () => {
    setLoading(true)
    setError(null)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    let query = supabase
      .from('follow_ups')
      .select('id, lead_id, reason, scheduled_at, channel, status, notes, lead:leads(id, first_name, last_name, phone, email, status)')
      .order('scheduled_at', { ascending: true })

    if (tab === 'done') {
      query = query.eq('status', 'fait')
    } else if (tab === 'today') {
      query = query
        .eq('status', 'en_attente')
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
    } else if (tab === 'overdue') {
      query = query.eq('status', 'en_attente').lt('scheduled_at', todayStart.toISOString())
    } else if (tab === 'upcoming') {
      query = query.eq('status', 'en_attente').gt('scheduled_at', todayEnd.toISOString())
    }

    const { data, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
      setFollowUps([])
    } else {
      setFollowUps((data ?? []) as unknown as FollowUpWithLead[])
    }
    setLoading(false)
  }, [tab])

  useEffect(() => {
    void fetchFollowUps()
  }, [fetchFollowUps])

  useEffect(() => {
    const channel = supabase
      .channel('follow-ups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, () => {
        void fetchFollowUps()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchFollowUps])

  return { followUps, loading, error, refetch: fetchFollowUps }
}
