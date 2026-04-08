import { sendIgMessage } from '@/lib/instagram/api'
import type { ExecutionContext } from './index'

/**
 * Action: send_dm_instagram
 * Sends an Instagram DM to a lead via Meta API.
 *
 * Config:
 *   - message or template_text: string — message template (supports variables)
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  if (!context.leadId) {
    return { success: false, error: 'No lead_id provided for send_dm_instagram action' }
  }

  // 1. Get message template
  const rawMessage = (config.message as string) || (config.template_text as string) || ''
  if (!rawMessage) {
    return { success: false, error: 'No message template provided' }
  }

  // 2. Resolve template variables
  const message = context.resolveTemplate(rawMessage)

  // 3. Get Meta/IG credentials for the workspace
  const { data: integration } = await context.supabase
    .from('integrations')
    .select('credentials_encrypted, meta_page_id')
    .eq('workspace_id', context.workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .single()

  if (!integration) {
    return { success: true, result: { skipped: true, reason: 'Meta integration not connected' } }
  }

  // 4. Get page_id — from integration or ig_accounts table
  let pageId = integration.meta_page_id as string | null

  if (!pageId) {
    const { data: igAccount } = await context.supabase
      .from('ig_accounts')
      .select('page_id, page_access_token')
      .eq('workspace_id', context.workspaceId)
      .eq('is_connected', true)
      .limit(1)
      .single()

    if (igAccount?.page_id) {
      pageId = igAccount.page_id
    }
  }

  if (!pageId) {
    return { success: true, result: { skipped: true, reason: 'No Instagram page connected' } }
  }

  // 5. Find the participant_ig_id for this lead
  const { data: conversation } = await context.supabase
    .from('ig_conversations')
    .select('participant_ig_id')
    .eq('workspace_id', context.workspaceId)
    .eq('lead_id', context.leadId)
    .limit(1)
    .single()

  if (!conversation?.participant_ig_id) {
    return { success: true, result: { skipped: true, reason: 'Aucune conversation IG liee a ce lead' } }
  }

  // 6. Get the page access token from ig_accounts
  const { data: igAccount } = await context.supabase
    .from('ig_accounts')
    .select('page_access_token')
    .eq('workspace_id', context.workspaceId)
    .eq('page_id', pageId)
    .single()

  const token = igAccount?.page_access_token as string | null
  if (!token) {
    return { success: false, error: 'No page access token found for Instagram messaging' }
  }

  // 7. Send the message
  try {
    const messageId = await sendIgMessage(token, pageId, conversation.participant_ig_id, message)
    return { success: true, result: { messageId, recipientId: conversation.participant_ig_id } }
  } catch (err) {
    return { success: false, error: `Instagram DM failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}
