/**
 * Batch email sender with rate limiting.
 * Sends emails in batches of BATCH_SIZE with a delay between batches.
 * Resend rate limit: 10 requests/second on free plan, 100/s on paid.
 */

import { sendEmail, type EmailConfig } from './client'
import { buildUnsubscribeUrl, buildUnsubscribeApiUrl } from './unsubscribe'

const BATCH_SIZE = 100
const BATCH_DELAY_MS = 1100 // slightly over 1s to stay safe

export interface BatchRecipient {
  leadId: string
  workspaceId: string
  email: string
  htmlBody: string  // already compiled with variables resolved
  subject: string
}

export interface BatchResult {
  sent: number
  failed: number
  results: Array<{
    leadId: string
    resendEmailId?: string
    error?: string
  }>
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Inject unsubscribe link and List-Unsubscribe header into email HTML.
 */
function injectUnsubscribeLink(html: string, leadId: string, workspaceId: string): string {
  const url = buildUnsubscribeUrl(leadId, workspaceId)
  const unsubLink = `<p style="text-align:center;font-size:12px;color:#999;margin-top:24px;"><a href="${url}" style="color:#999;text-decoration:underline;">Se désinscrire</a></p>`

  // Insert before closing </body> or append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${unsubLink}</body>`)
  }
  return html + unsubLink
}

/**
 * Send emails in batches with rate limiting.
 */
export async function sendBatch(
  config: EmailConfig,
  recipients: BatchRecipient[],
): Promise<BatchResult> {
  const result: BatchResult = { sent: 0, failed: 0, results: [] }

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    // Send batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (recipient) => {
        const unsubscribeUrl = buildUnsubscribeApiUrl(recipient.leadId, recipient.workspaceId)
        const htmlWithUnsub = injectUnsubscribeLink(
          recipient.htmlBody,
          recipient.leadId,
          recipient.workspaceId,
        )

        const res = await sendEmail(
          { ...config, unsubscribeUrl, workspaceId: recipient.workspaceId },
          recipient.email,
          recipient.subject,
          htmlWithUnsub,
        )
        return { leadId: recipient.leadId, ...res }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        if (r.value.ok) {
          result.sent++
          result.results.push({ leadId: r.value.leadId, resendEmailId: r.value.id })
        } else {
          result.failed++
          result.results.push({ leadId: r.value.leadId, error: r.value.error })
        }
      } else {
        result.failed++
        result.results.push({ leadId: 'unknown', error: r.reason?.message || 'Unknown error' })
      }
    }

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < recipients.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return result
}
