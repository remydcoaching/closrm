import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface FunnelPeriodData {
  profile_visits: number
  followers: number
  followers_total: number
  qualified_followers: number
  conversations: number
  appointments: number
  show_ups: number
  cash_collected: null
}

async function fetchFunnelData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  dateFrom: string,
  dateTo: string
): Promise<FunnelPeriodData> {
  // 1. ig_snapshots: first and last snapshot in period
  const [firstSnapshotRes, lastSnapshotRes] = await Promise.all([
    supabase
      .from('ig_snapshots')
      .select('followers, total_reach')
      .eq('workspace_id', workspaceId)
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ig_snapshots')
      .select('followers, total_reach')
      .eq('workspace_id', workspaceId)
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const firstSnapshot = firstSnapshotRes.data
  const lastSnapshot = lastSnapshotRes.data

  const followersTotal = lastSnapshot?.followers ?? 0
  const followersGained = (lastSnapshot?.followers ?? 0) - (firstSnapshot?.followers ?? 0)

  // Profile visits = sum of total_reach across all snapshots in period
  const { data: reachSnapshots } = await supabase
    .from('ig_snapshots')
    .select('total_reach')
    .eq('workspace_id', workspaceId)
    .gte('snapshot_date', dateFrom)
    .lte('snapshot_date', dateTo)

  const profileVisits = (reachSnapshots ?? []).reduce(
    (sum, s) => sum + (s.total_reach ?? 0),
    0
  )

  // 2. Qualified followers: leads with source in follow_ads/instagram_ads
  const { count: qualifiedFollowers } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('source', ['follow_ads', 'instagram_ads'])
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo + 'T23:59:59.999Z')

  // 3. Conversations — only IG conversations linked to follow_ads/instagram_ads leads
  // First get lead IDs from follow ads sources
  const { data: followAdsLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('source', ['follow_ads', 'instagram_ads'])

  const followAdsLeadIds = (followAdsLeads ?? []).map(l => l.id)

  let conversations = 0
  if (followAdsLeadIds.length > 0) {
    const { count } = await supabase
      .from('ig_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('lead_id', followAdsLeadIds)
    conversations = count ?? 0
  }

  // 4. Appointments — only bookings linked to follow_ads/instagram_ads leads
  let appointments = 0
  let showUps = 0
  if (followAdsLeadIds.length > 0) {
    const { count: apptCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('lead_id', followAdsLeadIds)
      .gte('scheduled_at', dateFrom)
      .lte('scheduled_at', dateTo + 'T23:59:59.999Z')
    appointments = apptCount ?? 0

    // 5. Show-ups — only completed/confirmed bookings for follow ads leads
    const { count: showCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('lead_id', followAdsLeadIds)
      .in('status', ['completed', 'confirmed'])
      .gte('scheduled_at', dateFrom)
      .lte('scheduled_at', dateTo + 'T23:59:59.999Z')
    showUps = showCount ?? 0
  }

  return {
    profile_visits: profileVisits,
    followers: followersGained,
    followers_total: followersTotal,
    qualified_followers: qualifiedFollowers ?? 0,
    conversations: conversations ?? 0,
    appointments: appointments ?? 0,
    show_ups: showUps ?? 0,
    cash_collected: null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const dateFrom = request.nextUrl.searchParams.get('date_from')
    const dateTo = request.nextUrl.searchParams.get('date_to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from and date_to are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Calculate previous period (same duration, shifted before)
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const durationMs = to.getTime() - from.getTime()
    const prevTo = new Date(from.getTime() - 1) // day before current period start
    const prevFrom = new Date(prevTo.getTime() - durationMs)

    const prevDateFrom = prevFrom.toISOString().split('T')[0]
    const prevDateTo = prevTo.toISOString().split('T')[0]

    const [funnel, previousPeriod] = await Promise.all([
      fetchFunnelData(supabase, workspaceId, dateFrom, dateTo),
      fetchFunnelData(supabase, workspaceId, prevDateFrom, prevDateTo),
    ])

    return NextResponse.json({
      data: {
        funnel,
        previous_period: previousPeriod,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[API /performance/follow-ads]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
