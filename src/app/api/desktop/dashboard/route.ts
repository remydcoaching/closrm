import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { fetchKpisV2, getNextBooking, getDayPlan, getRiskLeads, getHotLeads, getFunnelData, getRecentBookings } from '@/lib/dashboard/v2-queries'
import { fetchOverdueFollowUps } from '@/lib/dashboard/queries'

/**
 * Admin dashboard snapshot in one round-trip — the exact server queries the
 * web dashboard page runs (src/lib/dashboard/v2-queries.ts), in parallel.
 * Setter/closer dashboards keep their own endpoints (role returned here so
 * the desktop can switch).
 */
const PERIODS = [7, 30, 90]

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, role } = await getWorkspaceId()
    if (role !== 'admin') return NextResponse.json({ data: { role } })
    const p = Number(request.nextUrl.searchParams.get('period'))
    const period = PERIODS.includes(p) ? p : 30
    const t0 = Date.now()
    const [kpis, nextBooking, dayPlan, riskLeads, hotLeads, funnel, recentBookings, overdueFollowUps] = await Promise.all([
      fetchKpisV2(workspaceId, period),
      getNextBooking(workspaceId),
      getDayPlan(workspaceId),
      getRiskLeads(workspaceId),
      getHotLeads(workspaceId),
      getFunnelData(workspaceId, period),
      getRecentBookings(workspaceId),
      fetchOverdueFollowUps(workspaceId),
    ])
    return NextResponse.json(
      { data: { role, period, kpis, nextBooking, dayPlan, riskLeads, hotLeads, funnel, recentBookings, overdueFollowUps } },
      { headers: { 'Server-Timing': `total;dur=${Date.now() - t0}` } },
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
