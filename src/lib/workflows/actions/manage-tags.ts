import type { ExecutionContext } from './index'

/**
 * Action: add_tag / remove_tag
 * Adds or removes a tag from the lead's tags array.
 *
 * Config:
 *   - tag: string — the tag to add or remove
 *
 * The action type (add_tag / remove_tag) is passed via context.actionType.
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for manage_tags action' }
  }

  const tag = String(config.tag ?? '')
  if (!tag) {
    return { success: false, error: 'No tag specified in action config' }
  }

  const isRemove = context.actionType === 'remove_tag'

  // Use Postgres array functions for atomic operations
  const { error } = await context.supabase.rpc(
    isRemove ? 'array_remove_tag' : 'array_append_tag',
    {
      p_lead_id: context.leadId,
      p_workspace_id: context.workspaceId,
      p_tag: tag,
    }
  )

  // Fallback: if RPC not available, do read-modify-write
  if (error?.message?.includes('function') || error?.code === '42883') {
    const { data: lead, error: fetchError } = await context.supabase
      .from('leads')
      .select('tags')
      .eq('id', context.leadId)
      .eq('workspace_id', context.workspaceId)
      .single()

    if (fetchError || !lead) {
      return { success: false, error: `Failed to fetch lead tags: ${fetchError?.message ?? 'Lead not found'}` }
    }

    const currentTags: string[] = lead.tags ?? []
    const updatedTags = isRemove
      ? currentTags.filter((t: string) => t !== tag)
      : currentTags.includes(tag) ? currentTags : [...currentTags, tag]

    const { error: updateError } = await context.supabase
      .from('leads')
      .update({ tags: updatedTags, updated_at: new Date().toISOString() })
      .eq('id', context.leadId)
      .eq('workspace_id', context.workspaceId)

    if (updateError) {
      return { success: false, error: `Failed to update lead tags: ${updateError.message}` }
    }
  } else if (error) {
    return { success: false, error: `Failed to ${isRemove ? 'remove' : 'add'} tag: ${error.message}` }
  }

  return { success: true, result: { action: isRemove ? 'removed' : 'added', tag } }
}
