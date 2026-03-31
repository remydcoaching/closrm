import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { sendTelegramMessage } from '@/lib/telegram/client'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import type { ExecutionContext } from './index'

/**
 * Action: send_notification
 * Sends a notification to the COACH (not the lead) via Telegram or WhatsApp.
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const channel = (config.channel as string) || 'telegram'
  const messageTemplate = (config.message as string) || ''
  const message = context.resolveTemplate(messageTemplate)

  if (channel === 'telegram') {
    const creds = await getIntegrationCredentials(context.workspaceId, 'telegram')
    if (!creds) return { success: true, result: { skipped: true, reason: 'Telegram not connected' } }

    const result = await sendTelegramMessage(
      { botToken: creds.botToken, chatId: creds.chatId },
      message
    )
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, result: { channel: 'telegram', delivered: true } }
  }

  if (channel === 'whatsapp') {
    const creds = await getIntegrationCredentials(context.workspaceId, 'whatsapp')
    if (!creds) return { success: true, result: { skipped: true, reason: 'WhatsApp not connected' } }

    // For coach notification, use the coach's phone from credentials
    const coachPhone = creds.coachPhone || ''
    if (!coachPhone) return { success: true, result: { skipped: true, reason: 'No coach phone configured' } }

    const result = await sendWhatsAppMessage(
      { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken },
      coachPhone,
      message
    )
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, result: { channel: 'whatsapp', delivered: true, messageId: result.messageId } }
  }

  return { success: false, error: `Unknown notification channel: ${channel}` }
}
