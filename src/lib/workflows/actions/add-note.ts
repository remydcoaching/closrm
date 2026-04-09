import type { ExecutionContext } from './index'

/**
 * Action: add_note
 * Appends a note to the lead's notes field.
 *
 * Config:
 *   - note: string — the note text (supports template variables)
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for add_note action' }
  }

  const rawNote = (config.note as string) || ''
  const resolvedNote = context.resolveTemplate(rawNote)

  if (!resolvedNote) {
    return { success: true, result: { skipped: true, reason: 'Empty note' } }
  }

  // Fetch current notes to append
  const { data: lead } = await context.supabase
    .from('leads')
    .select('notes')
    .eq('id', context.leadId)
    .eq('workspace_id', context.workspaceId)
    .single()

  const existingNotes = (lead?.notes as string) || ''
  const newNotes = existingNotes ? `${existingNotes}\n${resolvedNote}` : resolvedNote

  const { error } = await context.supabase
    .from('leads')
    .update({ notes: newNotes, updated_at: new Date().toISOString() })
    .eq('id', context.leadId)
    .eq('workspace_id', context.workspaceId)

  if (error) return { success: false, error: `Failed to add note: ${error.message}` }
  return { success: true, result: { note: resolvedNote } }
}
