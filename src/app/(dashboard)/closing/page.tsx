import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import ClosingClient from './closing-client'

export default async function ClosingPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch initial "today" tab calls + all tab counts in parallel
  const [callsResult, todayCount, upcomingCount, overdueCount, doneCount, cancelledCount] = await Promise.all([
    // Today's pending calls (default tab)
    supabase
      .from('calls')
      .select('*, lead:leads!inner(id, first_name, last_name, phone, email, status), booking:bookings(id, booking_calendar:booking_calendars(name))', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'pending')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true })
      .range(0, 24),

    // Count: today
    supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'pending')
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', todayEnd.toISOString()),

    // Count: upcoming
    supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'pending')
      .gte('scheduled_at', todayEnd.toISOString()),

    // Count: overdue
    supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'pending')
      .lt('scheduled_at', todayStart.toISOString()),

    // Count: done
    supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('outcome', 'done'),

    // Count: cancelled/no_show
    supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('outcome', ['cancelled', 'no_show']),
  ])

  const total = callsResult.count ?? 0

  return (
    <ClosingClient
      initialCalls={callsResult.data ?? []}
      initialMeta={{
        total,
        page: 1,
        per_page: 25,
        total_pages: Math.ceil(total / 25),
      }}
      initialCounts={{
        today: todayCount.count ?? 0,
        upcoming: upcomingCount.count ?? 0,
        overdue: overdueCount.count ?? 0,
        done: doneCount.count ?? 0,
        cancelled: cancelledCount.count ?? 0,
      }}
    />
  )
}
