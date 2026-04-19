/**
 * Envoi email SES v2 avec support des headers custom (threading In-Reply-To / References).
 * Utilise Simple content + Headers[] (supporté par SESv2 SendEmailCommand).
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

let _client: SESv2Client | null = null
function getClient(): SESv2Client {
  if (_client) return _client
  _client = new SESv2Client({ region: process.env.AWS_REGION || 'eu-west-3' })
  return _client
}

export interface SendThreadedEmailInput {
  fromEmail: string
  fromName?: string
  to: string
  replyTo?: string
  subject: string
  bodyHtml?: string
  bodyText?: string
  inReplyTo?: string | null
  references?: string | null
  configurationSetName?: string
}

export interface SendThreadedEmailResult {
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendThreadedEmail(
  input: SendThreadedEmailInput,
): Promise<SendThreadedEmailResult> {
  const fromHeader = input.fromName
    ? `${input.fromName} <${input.fromEmail}>`
    : input.fromEmail

  const headers: Array<{ Name: string; Value: string }> = []
  if (input.inReplyTo) headers.push({ Name: 'In-Reply-To', Value: input.inReplyTo })
  if (input.references) headers.push({ Name: 'References', Value: input.references })

  const body: { Html?: { Data: string; Charset: string }; Text?: { Data: string; Charset: string } } = {}
  if (input.bodyHtml) body.Html = { Data: input.bodyHtml, Charset: 'UTF-8' }
  if (input.bodyText) body.Text = { Data: input.bodyText, Charset: 'UTF-8' }
  if (!body.Html && !body.Text) body.Text = { Data: '', Charset: 'UTF-8' }

  const command = new SendEmailCommand({
    FromEmailAddress: fromHeader,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    ConfigurationSetName: input.configurationSetName || process.env.SES_CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: body,
        Headers: headers.length > 0 ? headers : undefined,
      },
    },
  })

  try {
    const res = await getClient().send(command)
    return { ok: true, messageId: res.MessageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
