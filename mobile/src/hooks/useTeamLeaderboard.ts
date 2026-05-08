import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

export interface TeamMember {
  user_id: string
  full_name: string
  avatar_url: string | null
  role: string
  /** Nombre de deals fermés sur la semaine courante. */
  deals_count: number
  /** Revenue cumulé (€) sur la semaine. */
  revenue: number
}

const startOfWeek = () => {
  const d = new Date()
  // ramène au lundi 00:00
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useTeamLeaderboard() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const weekStart = startOfWeek().toISOString()
      // 1. Récupère les membres du workspace + profil user.
      const { data: rows, error: e1 } = await supabase
        .from('workspace_members')
        .select('user_id, role, status, user:users!inner(full_name, avatar_url)')
        .eq('status', 'active')
      if (e1) throw e1

      // 2. Pour chaque membre, count des deals fermés cette semaine.
      // Une seule query agrégée serait plus efficace mais Supabase JS ne
      // supporte pas joliment GROUP BY. Pour V1, on fait 1 query par
      // membre (max ~5 membres en pratique, négligeable).
      const enriched: TeamMember[] = await Promise.all(
        ((rows ?? []) as Array<{
          user_id: string
          role: string
          user: { full_name: string; avatar_url: string | null } | { full_name: string; avatar_url: string | null }[]
        }>).map(async (m) => {
          const { data: deals } = await supabase
            .from('deals')
            .select('amount')
            .eq('closer_id', m.user_id)
            .gte('created_at', weekStart)
          const list = deals ?? []
          const revenue = list.reduce(
            (acc, d: { amount: number | null }) => acc + (d.amount ?? 0),
            0,
          )
          // user can come back as object or [object] depending on relationship cardinality
          const userObj = Array.isArray(m.user) ? m.user[0] : m.user
          return {
            user_id: m.user_id,
            full_name: userObj?.full_name ?? '—',
            avatar_url: userObj?.avatar_url ?? null,
            role: m.role,
            deals_count: list.length,
            revenue,
          }
        }),
      )

      // Trie par revenue desc, puis deals_count desc.
      enriched.sort((a, b) => b.revenue - a.revenue || b.deals_count - a.deals_count)
      setMembers(enriched)
    } catch {
      // V1 silent — la section affichera un état vide
      setMembers([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return { members, loading, refetch: fetch }
}
