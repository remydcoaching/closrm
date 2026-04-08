import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import type { ExecutionContext } from './index'

/**
 * Action: create_google_meet
 * Creates a Google Calendar event with a Meet link.
 *
 * Config:
 *   - title?: string — custom title (supports template variables)
 *   - duration_minutes?: number — duration in minutes (default 60)
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const firstName = (context.lead?.first_name as string) || ''
  const lastName = (context.lead?.last_name as string) || ''

  const rawTitle = (config.title as string) || `RDV ${firstName} ${lastName}`.trim()
  const title = context.resolveTemplate(rawTitle)
  const durationMinutes = (config.duration_minutes as number) || 60

  const start = new Date()
  // Schedule 1 day from now by default
  start.setDate(start.getDate() + 1)
  start.setMinutes(0, 0, 0)

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  const event = await createGoogleCalendarEvent(context.workspaceId, {
    summary: title,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }, { withMeet: true })

  if (!event) {
    return { success: false, error: 'Failed to create Google Calendar event (Google not connected or API error)' }
  }

  return {
    success: true,
    result: {
      eventId: event.eventId,
      meetUrl: event.meetUrl,
      title,
      durationMinutes,
    },
  }
}
