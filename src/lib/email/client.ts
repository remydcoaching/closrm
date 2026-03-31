const RESEND_API = 'https://api.resend.com'

export interface EmailConfig {
  apiKey: string
  fromEmail?: string
  fromName?: string
}

export async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.fromName || 'ClosRM'} <${config.fromEmail || 'noreply@closrm.com'}>`,
      to: [to],
      subject,
      html: htmlBody,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return { ok: false, error: data.message || 'Resend API error' }
  }
  return { ok: true, id: data.id }
}
