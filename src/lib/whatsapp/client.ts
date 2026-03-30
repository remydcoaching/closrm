const WHATSAPP_API = 'https://graph.facebook.com/v19.0'

export interface WhatsAppConfig {
  phoneNumberId: string
  accessToken: string
}

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  to: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const url = `${WHATSAPP_API}/${config.phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to, // phone number with country code, e.g. '33612345678'
      type: 'text',
      text: { body: message },
    }),
  })
  const data = await res.json()
  if (data.error) {
    return { ok: false, error: data.error.message || 'WhatsApp API error' }
  }
  return { ok: true, messageId: data.messages?.[0]?.id }
}
