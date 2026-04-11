import { createServiceClient } from '@/lib/supabase/service'

/**
 * Returns the closer with the fewest confirmed bookings this week.
 * Uses service client to bypass RLS when querying workspace_members.
 *
 * Returns null if no active closer exists in the workspace.
 */
export async function getNextCloser(workspaceId: string): Promise<string | null> {
  const supabase = createServiceClient()

  // 1. Fetch all active closers
  const { data: closers, error: closersError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'closer')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (closersError || !closers || closers.length === 0) {
    return null
  }

  // 2. Compute Monday 00:00 and Sunday 23:59:59 of the current week (UTC)
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + diffToMonday,
    0, 0, 0, 0,
  ))
  const sunday = new Date(Date.UTC(
    monday.getUTCFullYear(),
    monday.getUTCMonth(),
    monday.getUTCDate() + 6,
    23, 59, 59, 999,
  ))

  const mondayISO = monday.toISOString()
  const sundayISO = sunday.toISOString()

  // 3. For each closer, count confirmed bookings this week via leads they're assigned to
  const closerIds = closers.map((c) => c.user_id)

  // Count closing calls (pending) assigned to each closer this week
  const { data: calls } = await supabase
    .from('calls')
    .select('assigned_to')
    .eq('workspace_id', workspaceId)
    .eq('type', 'closing')
    .eq('outcome', 'pending')
    .in('assigned_to', closerIds)
    .gte('scheduled_at', mondayISO)
    .lte('scheduled_at', sundayISO)

  // Also count leads in closing_planifie assigned this week
  const { data: leads } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('workspace_id', workspaceId)
    .eq('status', 'closing_planifie')
    .in('assigned_to', closerIds)

  // Build load map: closer_id -> count
  const loadMap = new Map<string, number>()
  for (const id of closerIds) {
    loadMap.set(id, 0)
  }

  if (calls) {
    for (const call of calls) {
      if (call.assigned_to) {
        loadMap.set(call.assigned_to, (loadMap.get(call.assigned_to) ?? 0) + 1)
      }
    }
  }

  if (leads) {
    for (const lead of leads) {
      if (lead.assigned_to) {
        loadMap.set(lead.assigned_to, (loadMap.get(lead.assigned_to) ?? 0) + 1)
      }
    }
  }

  // 4. Return the closer with the fewest assignments
  // Ties broken by insertion order (closerIds is already ordered by created_at ASC)
  let minId = closerIds[0]
  let minCount = loadMap.get(minId) ?? 0

  for (const id of closerIds) {
    const count = loadMap.get(id) ?? 0
    if (count < minCount) {
      minCount = count
      minId = id
    }
  }

  return minId
}
