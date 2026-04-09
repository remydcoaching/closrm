import type { ExecutionContext } from './index'

/**
 * Action: schedule_call
 * Creates a new call (setting or closing) scheduled in the future.
 *
 * Config:
 *   - type?: 'setting' | 'closing' (default: 'setting')
 *   - delay_days?: number (default: 1)
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for schedule_call action' }
  }

  const callType = (config.type as string) || (config.call_type as string) || 'setting'
  const delayDays = (config.delay_days as number) ?? 1

  if (callType !== 'setting' && callType !== 'closing') {
    return { success: false, error: `Invalid call type: ${callType}` }
  }

  const scheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

  // Get attempt number
  const { count } = await context.supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', context.workspaceId)
    .eq('lead_id', context.leadId)
    .eq('type', callType)

  const { data, error } = await context.supabase
    .from('calls')
    .insert({
      workspace_id: context.workspaceId,
      lead_id: context.leadId,
      type: callType,
      scheduled_at: scheduledAt.toISOString(),
      outcome: 'pending',
      attempt_number: (count ?? 0) + 1,
      reached: false,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: `Failed to schedule call: ${error.message}` }
  return { success: true, result: { call_id: data.id, type: callType, scheduled_at: scheduledAt.toISOString() } }
}
