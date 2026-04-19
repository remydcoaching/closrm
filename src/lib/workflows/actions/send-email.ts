import { sendEmail } from '@/lib/email/client'
import { getWorkspaceSenderConfig } from '@/lib/email/sender-config'
import { consumeResource } from '@/lib/billing/service'
import type { ExecutionContext } from './index'

export async function execute(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<{ success: boolean; result?: Record<string, unknown>; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: true, result: { skipped: true, reason: 'RESEND_API_KEY not configured' } }

  const to = context.lead?.email as string
  if (!to) return { success: false, error: 'Lead has no email address' }

  const workspaceId = context.workspaceId
  if (!workspaceId) return { success: false, error: 'Missing workspace_id in context' }

  const subjectTemplate = (config.subject as string) || 'Notification'
  const messageTemplate = (config.message as string) || ''

  const subject = context.resolveTemplate(subjectTemplate)
  const body = context.resolveTemplate(messageTemplate)

  const htmlBody = `<div style="font-family:sans-serif;color:#333;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`

  // Quota check + débit (atomique côté DB)
  const consumeResult = await consumeResource({
    workspaceId,
    resourceType: 'email',
    quantity: 1,
    source: 'workflow',
    metadata: { lead_id: context.leadId, to },
  })

  if (!consumeResult.allowed) {
    return {
      success: false,
      error: consumeResult.error_message || 'Quota email dépassé',
    }
  }

  const senderConfig = await getWorkspaceSenderConfig(workspaceId, {
    fromEmail: config.from_email as string | undefined,
    fromName: config.from_name as string | undefined,
  })

  const result = await sendEmail(
    { apiKey, fromEmail: senderConfig.fromEmail, fromName: senderConfig.fromName },
    to,
    subject,
    htmlBody
  )

  if (!result.ok) return { success: false, error: result.error }
  return {
    success: true,
    result: {
      delivered: true,
      emailId: result.id,
      to,
      billed_from: consumeResult.billed_from,
      wallet_debited_cents: consumeResult.amount_cents_debited,
    },
  }
}
