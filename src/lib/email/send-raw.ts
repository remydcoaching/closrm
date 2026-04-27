/**
 * Envoi email SES v2 avec support des headers custom (threading In-Reply-To / References).
 * Utilise Simple content + Headers[] (supporté par SESv2 SendEmailCommand).
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createServiceClient } from '@/lib/supabase/service'
import { retrySesCall } from '@/lib/email/retry'

const SES_OUTBOUND_REGION = 'eu-west-3'

let _client: SESv2Client | null = null
function getClient(): SESv2Client {
  if (_client) return _client
  _client = new SESv2Client({ region: SES_OUTBOUND_REGION })
  return _client
}

/**
 * Vérifie si un recipient est sur la suppression list (bounce permanent ou complaint).
 * Bloque aussi bien les suppressions globales que celles scopées au workspace.
 * Si aucun workspace_id n'est fourni, on check seulement le global.
 */
async function isSuppressed(email: string, workspaceId?: string): Promise<boolean> {
  const supabase = createServiceClient()
  const normalized = email.trim().toLowerCase()
  let query = supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', normalized)
  if (workspaceId) {
    query = query.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
  } else {
    query = query.is('workspace_id', null)
  }
  const { data } = await query.limit(1).maybeSingle()
  return Boolean(data)
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
  /**
   * Workspace qui émet le mail. Utilisé pour check la suppression list scopée.
   * Si omis, on ne check que les suppressions globales (safe mais moins précis).
   */
  workspaceId?: string
  /**
   * URL unsubscribe signée. Déclenche l'ajout des headers List-Unsubscribe +
   * List-Unsubscribe-Post (obligatoires pour le bulk d'après Gmail).
   */
  unsubscribeUrl?: string
}

export interface SendThreadedEmailResult {
  ok: boolean
  messageId?: string
  error?: string
  suppressed?: boolean
}

export async function sendThreadedEmail(
  input: SendThreadedEmailInput,
): Promise<SendThreadedEmailResult> {
  // Gate suppression list : si le destinataire a hard-bounced ou complained,
  // on refuse l'envoi (protection de la réputation SES obligatoire).
  if (await isSuppressed(input.to, input.workspaceId)) {
    return { ok: false, suppressed: true, error: 'Destinataire sur la suppression list' }
  }

  const fromHeader = input.fromName
    ? `${input.fromName} <${input.fromEmail}>`
    : input.fromEmail

  const headers: Array<{ Name: string; Value: string }> = []
  if (input.inReplyTo) headers.push({ Name: 'In-Reply-To', Value: input.inReplyTo })
  if (input.references) headers.push({ Name: 'References', Value: input.references })
  if (input.unsubscribeUrl) {
    headers.push({ Name: 'List-Unsubscribe', Value: `<${input.unsubscribeUrl}>` })
    headers.push({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' })
  }

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
    const res = await retrySesCall(() => getClient().send(command), 'sendThreadedEmail')
    return { ok: true, messageId: res.MessageId }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
