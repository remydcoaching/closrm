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
import { createServiceClient } from '@/lib/supabase/service'
import { retrySesCall } from '@/lib/email/retry'

const SES_OUTBOUND_REGION = 'eu-west-3'

/**
 * Vérifie si une adresse est sur la suppression list (bounce permanent,
 * complaint, ou opt-out). Si oui, AWS SES refusera l'envoi et le compte
 * peut être suspendu → on doit skip AVANT tout débit wallet/quota.
 *
 * Exporté pour que les call sites (workflow, broadcast, cron) puissent
 * check en amont et éviter un débit sur un email qui ne partira pas.
 */
export async function isSuppressed(email: string, workspaceId?: string): Promise<boolean> {
  const supabase = createServiceClient()
  const normalized = email.trim().toLowerCase()
  let query = supabase.from('email_suppressions').select('id').eq('email', normalized)
  query = workspaceId
    ? query.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    : query.is('workspace_id', null)
  const { data } = await query.limit(1).maybeSingle()
  return Boolean(data)
}

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
  workspaceId?: string
  /**
   * URL d'un lien unsubscribe signé. Si fournie, ajoute les headers
   * List-Unsubscribe + List-Unsubscribe-Post (RFC 8058) qui permettent à
   * Gmail/Yahoo d'afficher un bouton "Se désabonner" dans la UI mail et
   * d'envoyer un POST one-click vers cette URL.
   *
   * Obligatoire pour les envois bulk/broadcasts d'après les règles Gmail de
   * février 2024 (senders > 5 000 mails/jour).
   */
  unsubscribeUrl?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
  suppressed?: boolean
}

const DEFAULT_FROM_EMAIL = 'noreply@closrm.fr'
const DEFAULT_FROM_NAME = 'ClosRM'

export async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  if (await isSuppressed(to, config.workspaceId)) {
    return { ok: false, suppressed: true, error: 'Destinataire sur la suppression list' }
  }

  const fromEmail = config.fromEmail || DEFAULT_FROM_EMAIL
  const fromName = config.fromName || DEFAULT_FROM_NAME
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail

  const configurationSetName =
    config.configurationSetName || process.env.SES_CONFIGURATION_SET

  const headers: Array<{ Name: string; Value: string }> = []
  if (config.unsubscribeUrl) {
    headers.push({ Name: 'List-Unsubscribe', Value: `<${config.unsubscribeUrl}>` })
    headers.push({ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' })
  }

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
        Headers: headers.length > 0 ? headers : undefined,
      },
    },
  })

  try {
    const res = await retrySesCall(() => getClient().send(command), 'sendEmail')
    return { ok: true, id: res.MessageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
