import type { ExecutionContext } from './index'

/**
 * Action: set_reached
 * Marks the lead as reached (reached = true).
 */
export async function execute(
  _config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for set_reached action' }
  }

  const { error } = await context.supabase
    .from('leads')
    .update({ reached: true, updated_at: new Date().toISOString() })
    .eq('id', context.leadId)
    .eq('workspace_id', context.workspaceId)

  if (error) return { success: false, error: `Failed to set reached: ${error.message}` }
  return { success: true, result: { reached: true } }
}
