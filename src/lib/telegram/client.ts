const TELEGRAM_API = 'https://api.telegram.org'

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `${TELEGRAM_API}/bot${config.botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  })
  const data = await res.json()
  if (!data.ok) {
    return { ok: false, error: data.description || 'Telegram API error' }
  }
  return { ok: true }
}
