import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import {
  fetchStatsKpis,
  fetchLeadsPerDay,
  fetchFunnelData,
  fetchSourceData,
  fetchMetaStats,
} from '@/lib/stats/queries'
import StatsClient from '@/components/stats/stats-client'

const VALID_PERIODS = [0, 7, 30, 90] as const
type Period = (typeof VALID_PERIODS)[number]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function StatistiquesPage({ searchParams }: Props) {
  const params = await searchParams
  const periodParam = Number(params.period)
  const period: Period = (VALID_PERIODS.includes(periodParam as Period) ? periodParam : 30) as Period

  const { workspaceId } = await getWorkspaceId()

  const [kpis, leadsPerDay, funnelData, sourceData, meta] = await Promise.all([
    fetchStatsKpis(workspaceId, period),
    fetchLeadsPerDay(workspaceId, period),
    fetchFunnelData(workspaceId, period),
    fetchSourceData(workspaceId, period),
    fetchMetaStats(workspaceId),
  ])

  return (
    <StatsClient
      period={period}
      kpis={kpis}
      leadsPerDay={leadsPerDay}
      funnelData={funnelData}
      sourceData={sourceData}
      meta={meta}
    />
  )
}
