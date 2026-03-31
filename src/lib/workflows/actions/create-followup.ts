import type { ExecutionContext } from './index'

/**
 * Action: create_followup
 * Creates a follow-up entry for the lead.
 *
 * Config:
 *   - reason: string — reason for the follow-up
 *   - channel: 'whatsapp' | 'email' | 'manuel'
 *   - delay_days?: number — days from now to schedule (default: 0 = now)
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for create_followup action' }
  }

  const reason = context.resolveTemplate(String(config.reason ?? 'Relance automatique'))
  const channel = String(config.channel ?? 'manuel') as 'whatsapp' | 'email' | 'manuel'
  const delayDays = Number(config.delay_days ?? 0)

  const scheduledAt = new Date()
  scheduledAt.setDate(scheduledAt.getDate() + delayDays)

  const { data, error } = await context.supabase
    .from('follow_ups')
    .insert({
      workspace_id: context.workspaceId,
      lead_id: context.leadId,
      reason,
      channel,
      status: 'en_attente',
      scheduled_at: scheduledAt.toISOString(),
      notes: 'Cree automatiquement par un workflow',
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: `Failed to create follow-up: ${error.message}` }
  }

  return { success: true, result: { follow_up_id: data.id, reason, channel, scheduled_at: scheduledAt.toISOString() } }
}
