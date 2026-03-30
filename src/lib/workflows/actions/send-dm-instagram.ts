import type { ExecutionContext } from './index'

/**
 * Action: send_dm_instagram (STUB)
 * Will send Instagram DMs via Meta API when integrated.
 * See task T-021 for full implementation.
 */
export async function execute(
  _config: Record<string, unknown>,
  _context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  // TODO T-021: Implement Instagram DM sending via Meta API
  // - Resolve template variables in message
  // - Use Instagram Messaging API to send the DM
  // - Return delivery status
  return {
    success: true,
    result: { skipped: true, reason: 'Instagram DM integration not configured (T-021)' },
  }
}
