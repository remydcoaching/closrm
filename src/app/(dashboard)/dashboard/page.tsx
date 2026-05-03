export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { unstable_noStore as noStore } from 'next/cache'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  fetchKpisV2,
  getNextBooking,
  getDayPlan,
  getRiskLeads,
  getHotLeads,
  getFunnelData,
  getRecentBookings,
} from '@/lib/dashboard/v2-queries'
import DashboardClientV2 from '@/components/dashboard/v2/dashboard-client-v2'
import SetterDashboard from '@/components/dashboard/SetterDashboard'
import CloserDashboard from '@/components/dashboard/CloserDashboard'

const VALID_PERIODS = [7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  noStore()
  const params = await searchParams
  const periodParam = Number(params.period)
  const period: Period = (VALID_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period

  const { workspaceId, userId, role } = await getWorkspaceId()

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach'

  if (role === 'setter') {
    return <SetterDashboard firstName={firstName} userId={userId} />
  }

  if (role === 'closer') {
    return <CloserDashboard firstName={firstName} userId={userId} />
  }

  // Admin → v2
  const [kpis, nextBooking, dayPlan, riskLeads, hotLeads, funnelData, recentBookings] =
    await Promise.all([
      fetchKpisV2(workspaceId, period),
      getNextBooking(workspaceId),
      getDayPlan(workspaceId),
      getRiskLeads(workspaceId),
      getHotLeads(workspaceId),
      getFunnelData(workspaceId, period),
      getRecentBookings(workspaceId),
    ])

  return (
    <DashboardClientV2
      firstName={firstName}
      period={period}
      kpis={kpis}
      nextBooking={nextBooking}
      dayPlan={dayPlan}
      riskLeads={riskLeads}
      hotLeads={hotLeads}
      funnelData={funnelData}
      recentBookings={recentBookings}
    />
  )
}
