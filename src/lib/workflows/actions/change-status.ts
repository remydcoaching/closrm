import type { ExecutionContext } from './index'
import type { LeadStatus } from '@/types'

/**
 * Action: change_lead_status
 * Updates the lead's pipeline status.
 *
 * Config:
 *   - status: LeadStatus — the new status to set
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for change_lead_status action' }
  }

  const newStatus = String(config.status) as LeadStatus

  const validStatuses: LeadStatus[] = [
    'nouveau', 'scripte', 'setting_planifie', 'no_show_setting',
    'closing_planifie', 'no_show_closing', 'clos', 'dead',
  ]

  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: `Invalid lead status: ${newStatus}` }
  }

  const { error } = await context.supabase
    .from('leads')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', context.leadId)
    .eq('workspace_id', context.workspaceId)

  if (error) {
    return { success: false, error: `Failed to update lead status: ${error.message}` }
  }

  return { success: true, result: { new_status: newStatus } }
}
