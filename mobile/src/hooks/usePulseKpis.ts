import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

export interface PulseKpis {
  revenueMonth: number
  callsDone: number
  callsPlanned: number
  showRate: number
  closingRate: number
  avgBasket: number
  funnel: {
    leads: number
    settingDone: number
    closingDone: number
    deals: number
  }
  /** 7 valeurs (lundi → dimanche) — count de leads par jour. */
  weeklyActivity: number[]
}

const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const last30Days = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const last7Days = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  d.setHours(0, 0, 0, 0)
  return d
}

export function usePulseKpis() {
  const [kpis, setKpis] = useState<PulseKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    const monthStart = startOfMonth()
    const thirtyDaysAgo = last30Days()
    const weekStart = last7Days()

    let dealsRes, callsRes, leadsRes, leads30Res, deals30Res, leadsWeekRes
    try {
      // Toutes les queries en parallèle. Promise.all rejecte au premier
      // fail → on wrap pour surface l'erreur et garder l'état précédent.
      ;[dealsRes, callsRes, leadsRes, leads30Res, deals30Res, leadsWeekRes] = await Promise.all([
      // Revenue du mois (deals créés dans le mois courant)
      supabase
        .from('deals')
        .select('amount, cash_collected, status')
        .gte('created_at', monthStart),
      // Calls du mois
      supabase
        .from('calls')
        .select('outcome, type')
        .gte('scheduled_at', monthStart),
      // Funnel : nb de leads créés sur 30j
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
      // Funnel : leads passés par chaque étape (snapshot statut)
      supabase
        .from('leads')
        .select('status')
        .gte('created_at', thirtyDaysAgo),
      // Funnel : nb deals 30j
      supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
      // Activité 7j (leads créés par jour)
      supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', weekStart.toISOString()),
    ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement KPIs')
      setLoading(false)
      return
    }

    const deals = dealsRes.data ?? []
    const calls = callsRes.data ?? []
    const leadsCount = leadsRes.count ?? 0
    const leads30 = leads30Res.data ?? []
    const dealsCount = deals30Res.count ?? 0
    const leadsWeek = leadsWeekRes.data ?? []

    const revenueMonth = deals.reduce((acc, d: { amount: number | null }) => acc + (d.amount ?? 0), 0)
    const callsDone = calls.filter((c: { outcome: string }) => c.outcome === 'done').length
    const callsPlanned =
      callsDone +
      calls.filter((c: { outcome: string }) => c.outcome === 'pending').length
    const noShowCount = calls.filter((c: { outcome: string }) => c.outcome === 'no_show').length
    const showRate =
      callsDone + noShowCount === 0 ? 0 : Math.round((callsDone / (callsDone + noShowCount)) * 100)

    const closingDoneCount = calls.filter(
      (c: { outcome: string; type: string }) => c.type === 'closing' && c.outcome === 'done',
    ).length
    const closingRate =
      closingDoneCount === 0 ? 0 : Math.round((dealsCount / Math.max(closingDoneCount, 1)) * 100)

    const avgBasket = dealsCount > 0 ? Math.round(revenueMonth / dealsCount) : 0

    // Funnel : approximation à partir des statuts actuels
    const settingDone = leads30.filter((l: { status: string }) =>
      ['closing_planifie', 'no_show_closing', 'clos', 'dead'].includes(l.status),
    ).length
    const closingDone = leads30.filter((l: { status: string }) => ['clos', 'dead'].includes(l.status)).length

    // Activité semaine — bucket par jour (0=lundi, 6=dimanche)
    const weeklyActivity = [0, 0, 0, 0, 0, 0, 0]
    for (const l of leadsWeek as { created_at: string }[]) {
      const d = new Date(l.created_at)
      const dayIdx = (d.getDay() + 6) % 7
      weeklyActivity[dayIdx]++
    }

    setKpis({
      revenueMonth,
      callsDone,
      callsPlanned,
      showRate,
      closingRate,
      avgBasket,
      funnel: { leads: leadsCount, settingDone, closingDone, deals: dealsCount },
      weeklyActivity,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  return { kpis, loading, error, refetch: fetch }
}
