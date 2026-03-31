import type { ExecutionContext } from './index'

/**
 * Action: facebook_conversions_api (STUB)
 * Will send conversion events to Facebook Conversions API.
 * See task T-013 for full implementation.
 */
export async function execute(
  _config: Record<string, unknown>,
  _context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  // TODO T-013: Implement Facebook Conversions API
  // - Build event payload (event_name, user data, custom data)
  // - Send to Meta Conversions API endpoint
  // - Return event_id and status
  return {
    success: true,
    result: { skipped: true, reason: 'Facebook Conversions API not configured (T-013)' },
  }
}
