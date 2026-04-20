/**
 * Email sending via AWS SES v2.
 *
 * Required env vars:
 *   AWS_REGION (e.g. eu-west-3)
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *
 * Optional:
 *   SES_CONFIGURATION_SET (recommandé pour tracking bounces/opens/clicks via SNS)
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const SES_OUTBOUND_REGION = 'eu-west-3'

let _client: SESv2Client | null = null

function getClient(): SESv2Client {
  if (_client) return _client
  _client = new SESv2Client({ region: SES_OUTBOUND_REGION })
  return _client
}

export interface EmailConfig {
  // Conservé pour compat avec les anciens call sites — ignoré côté SES
  // (les credentials viennent des env vars AWS_*).
  apiKey?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  configurationSetName?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

const DEFAULT_FROM_EMAIL = 'noreply@closrm.fr'
const DEFAULT_FROM_NAME = 'ClosRM'

export async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  const fromEmail = config.fromEmail || DEFAULT_FROM_EMAIL
  const fromName = config.fromName || DEFAULT_FROM_NAME
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail

  const configurationSetName =
    config.configurationSetName || process.env.SES_CONFIGURATION_SET

  const command = new SendEmailCommand({
    FromEmailAddress: fromHeader,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
    ConfigurationSetName: configurationSetName,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
        },
      },
    },
  })

  try {
    const res = await getClient().send(command)
    return { ok: true, id: res.MessageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
