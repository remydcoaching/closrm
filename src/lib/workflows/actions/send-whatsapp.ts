import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { sendWhatsAppMessage } from '@/lib/whatsapp/client'
import type { ExecutionContext } from './index'

/**
 * Action: send_whatsapp
 * Sends a WhatsApp message to the LEAD using Meta Cloud API.
 */
export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const creds = await getIntegrationCredentials(context.workspaceId, 'whatsapp')
  if (!creds) return { success: true, result: { skipped: true, reason: 'WhatsApp not connected' } }

  const messageTemplate = (config.message as string) || ''
  const message = context.resolveTemplate(messageTemplate)

  // Get lead phone number
  const phone = context.lead?.phone as string
  if (!phone) return { success: false, error: 'Lead has no phone number' }

  // Clean phone number (remove spaces, dashes, ensure country code)
  const cleanPhone = phone.replace(/[\s\-()]/g, '').replace(/^0/, '33')

  const result = await sendWhatsAppMessage(
    { phoneNumberId: creds.phoneNumberId, accessToken: creds.accessToken },
    cleanPhone,
    message
  )

  if (!result.ok) return { success: false, error: result.error }
  return { success: true, result: { delivered: true, messageId: result.messageId, to: cleanPhone } }
}
