import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import type { SocialPostWithPublications } from '../types/social'

interface FetchParams {
  // Filtre par plage de dates planifiées (YYYY-MM-DD côté API)
  planDateFrom?: string
  planDateTo?: string
  // Statut publication unique (draft, scheduled, ...)
  status?: string
}

export function useSocialPosts(params: FetchParams = {}) {
  const [posts, setPosts] = useState<SocialPostWithPublications[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (params.planDateFrom) qs.set('plan_date_from', params.planDateFrom)
      if (params.planDateTo) qs.set('plan_date_to', params.planDateTo)
      if (params.status) qs.set('status', params.status)
      qs.set('per_page', '200')
      const res = await api.get<{ data: SocialPostWithPublications[] }>(
        `/api/social/posts?${qs.toString()}`,
      )
      setPosts(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement posts')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [params.planDateFrom, params.planDateTo, params.status])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Realtime — refetch dès qu'un post change côté DB.
  useEffect(() => {
    const channel = supabase
      .channel('social-posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_posts' },
        () => {
          void fetch()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetch])

  return { posts, loading, error, refetch: fetch }
}
