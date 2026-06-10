import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Lead } from '@shared/types'

export interface UseLeadsOptions {
  segment?: 'actifs' | 'mes_leads' | 'archives'
  status?: string // 'tous' | LeadStatus
  search?: string
  myUserId?: string // pour le segment 'mes_leads'
}

export function useLeads(options: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })

    if (options.segment === 'archives') {
      query = query.eq('status', 'dead')
    } else {
      query = query.neq('status', 'dead')
    }

    if (options.segment === 'mes_leads' && options.myUserId) {
      query = query.eq('assigned_to', options.myUserId)
    }

    if (options.status && options.status !== 'tous') {
      query = query.eq('status', options.status)
    }

    if (options.search && options.search.length > 0) {
      const s = options.search.replace(/[%_]/g, '\\$&')
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`,
      )
    }

    const { data, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
      setLeads([])
    } else {
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }, [options.segment, options.status, options.search, options.myUserId])

  useEffect(() => {
    void fetchLeads()
  }, [fetchLeads])

  // Subscription temps réel : tout INSERT/UPDATE/DELETE sur leads → refetch.
  // Refetch global plutôt que merge en place pour rester simple ; les filtres
  // côté serveur garantissent qu'on récupère la liste correcte.
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        void fetchLeads()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchLeads])

  return { leads, loading, error, refetch: fetchLeads }
}
