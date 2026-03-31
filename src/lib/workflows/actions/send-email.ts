import { sendEmail } from '@/lib/email/client'
import type { ExecutionContext } from './index'

export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: true, result: { skipped: true, reason: 'RESEND_API_KEY not configured' } }

  const to = context.lead?.email as string
  if (!to) return { success: false, error: 'Lead has no email address' }

  const subjectTemplate = (config.subject as string) || 'Notification'
  const messageTemplate = (config.message as string) || ''

  const subject = context.resolveTemplate(subjectTemplate)
  const body = context.resolveTemplate(messageTemplate)

  const htmlBody = `<div style="font-family:sans-serif;color:#333;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`

  const result = await sendEmail(
    { apiKey, fromEmail: config.from_email as string, fromName: config.from_name as string },
    to,
    subject,
    htmlBody
  )

  if (!result.ok) return { success: false, error: result.error }
  return { success: true, result: { delivered: true, emailId: result.id, to } }
}
