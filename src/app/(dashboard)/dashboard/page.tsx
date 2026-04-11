import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  fetchKpis,
  fetchUpcomingCalls,
  fetchOverdueFollowUps,
  fetchRecentActivity,
} from '@/lib/dashboard/queries'
import DashboardClient from '@/components/dashboard/dashboard-client'
import SetterDashboard from '@/components/dashboard/SetterDashboard'
import CloserDashboard from '@/components/dashboard/CloserDashboard'

const VALID_PERIODS = [7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
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

  // Route par role : setter et closer ont leur propre dashboard
  if (role === 'setter') {
    return <SetterDashboard firstName={firstName} userId={userId} />
  }

  if (role === 'closer') {
    return <CloserDashboard firstName={firstName} userId={userId} />
  }

  // Admin : dashboard existant inchange
  const [kpis, upcomingCalls, overdueFollowUps, recentActivity] = await Promise.all([
    fetchKpis(workspaceId, period),
    fetchUpcomingCalls(workspaceId),
    fetchOverdueFollowUps(workspaceId),
    fetchRecentActivity(workspaceId),
  ])

  return (
    <DashboardClient
      firstName={firstName}
      period={period}
      kpis={kpis}
      upcomingCalls={upcomingCalls}
      overdueFollowUps={overdueFollowUps}
      recentActivity={recentActivity}
    />
  )
}
