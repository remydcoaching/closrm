import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import FollowUpsClient from './follow-ups-client'

export default async function FollowUpsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch initial "today" tab follow-ups + all tab counts in parallel
  const [fuResult, todayCount, overdueCount, upcomingCount, doneCount, allCount] = await Promise.all([
    // Today's pending follow-ups (default tab)
    supabase
      .from('follow_ups')
      .select('*, lead:leads!inner(id, first_name, last_name, phone, email, status)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .range(0, 24),

    // Count: today
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString()),

    // Count: overdue
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')
      .lt('scheduled_at', todayStart.toISOString()),

    // Count: upcoming
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')
      .gte('scheduled_at', todayEnd.toISOString()),

    // Count: done (fait + annule)
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('status', ['fait', 'annule']),

    // Count: all
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
  ])

  const total = fuResult.count ?? 0

  return (
    <FollowUpsClient
      initialFollowUps={fuResult.data ?? []}
      initialMeta={{
        total,
        page: 1,
        per_page: 25,
        total_pages: Math.ceil(total / 25),
      }}
      initialCounts={{
        today: todayCount.count ?? 0,
        overdue: overdueCount.count ?? 0,
        upcoming: upcomingCount.count ?? 0,
        done: doneCount.count ?? 0,
        all: allCount.count ?? 0,
      }}
    />
  )
}
