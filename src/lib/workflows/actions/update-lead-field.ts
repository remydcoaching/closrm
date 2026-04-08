import type { ExecutionContext } from './index'

/**
 * Action: update_lead_field
 * Updates a whitelisted field on the lead.
 *
 * Config:
 *   - field: string — the field to update (must be in whitelist)
 *   - value: string — the new value (supports template variables)
 *
 * Special handling for `tags`:
 *   - value starting with '+' → append tag
 *   - value starting with '-' → remove tag
 *   - otherwise → replace entire tags array (comma-separated)
 */

const ALLOWED_FIELDS = ['status', 'notes', 'reached', 'tags', 'instagram_handle']

export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for update_lead_field action' }
  }

  const field = config.field as string
  if (!field || !ALLOWED_FIELDS.includes(field)) {
    return { success: false, error: `Champ non autorise: ${field}. Champs autorises: ${ALLOWED_FIELDS.join(', ')}` }
  }

  const rawValue = (config.value as string) || ''
  const resolvedValue = context.resolveTemplate(rawValue)

  // Special handling for tags
  if (field === 'tags') {
    // Fetch current tags
    const { data: lead } = await context.supabase
      .from('leads')
      .select('tags')
      .eq('id', context.leadId)
      .eq('workspace_id', context.workspaceId)
      .single()

    const currentTags: string[] = (lead?.tags as string[]) ?? []
    let newTags: string[]

    if (resolvedValue.startsWith('+')) {
      const tagToAdd = resolvedValue.slice(1).trim()
      newTags = currentTags.includes(tagToAdd) ? currentTags : [...currentTags, tagToAdd]
    } else if (resolvedValue.startsWith('-')) {
      const tagToRemove = resolvedValue.slice(1).trim()
      newTags = currentTags.filter(t => t !== tagToRemove)
    } else {
      newTags = resolvedValue.split(',').map(t => t.trim()).filter(Boolean)
    }

    const { error } = await context.supabase
      .from('leads')
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq('id', context.leadId)
      .eq('workspace_id', context.workspaceId)

    if (error) return { success: false, error: `Failed to update tags: ${error.message}` }
    return { success: true, result: { field: 'tags', newValue: newTags } }
  }

  // Special handling for reached (boolean)
  let finalValue: string | boolean = resolvedValue
  if (field === 'reached') {
    finalValue = resolvedValue === 'true' || resolvedValue === '1'
  }

  const { error } = await context.supabase
    .from('leads')
    .update({ [field]: finalValue, updated_at: new Date().toISOString() })
    .eq('id', context.leadId)
    .eq('workspace_id', context.workspaceId)

  if (error) return { success: false, error: `Failed to update ${field}: ${error.message}` }
  return { success: true, result: { field, newValue: finalValue } }
}
