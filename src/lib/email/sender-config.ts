/**
 * Helper qui retourne la configuration d'expéditeur email d'un workspace.
 *
 * Logique :
 * 1. Si le workspace a un email_domain vérifié avec un default_from_email → utilise ça
 * 2. Sinon → fallback sur les valeurs par défaut ClosRM (noreply@closrm.fr)
 *
 * Tous les call sites d'envoi d'email (workflows, broadcasts, booking confirms,
 * batch sender…) doivent passer par ce helper pour respecter le domaine custom
 * configuré par le coach.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getInboundSubdomain } from '@/lib/email/domains'

const DEFAULT_FROM_EMAIL = 'noreply@closrm.fr'
const DEFAULT_FROM_NAME = 'ClosRM'

export interface SenderConfig {
  fromEmail: string
  fromName: string
  /**
   * Adresse Reply-To que les clients mail (Gmail, Outlook…) utilisent quand
   * le lead clique "Répondre". Pointe sur le sous-domaine inbound
   * (reply.{domain}) qui a le MX configuré pour que les réponses soient
   * captées par le webhook SES inbound et remontées dans la conversation.
   *
   * Si absent, Gmail essaie d'écrire à fromEmail (= racine du domaine),
   * qui n'a pas de MX → bounce "Adresse introuvable".
   */
  replyTo?: string
}

/**
 * Récupère le from email/name à utiliser pour les envois d'un workspace.
 * Priorité : domaine custom vérifié du workspace > fallback ClosRM.
 *
 * @param workspaceId UUID du workspace
 * @param overrides champs explicitement passés par le caller (priorité absolue)
 */
export async function getWorkspaceSenderConfig(
  workspaceId: string,
  overrides?: Partial<SenderConfig>,
): Promise<SenderConfig> {
  if (overrides?.fromEmail && overrides?.fromName) {
    return {
      fromEmail: overrides.fromEmail,
      fromName: overrides.fromName,
      replyTo: overrides.replyTo,
    }
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('email_domains')
    .select('domain, default_from_email, default_from_name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .not('default_from_email', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const fromEmail = overrides?.fromEmail || data?.default_from_email || DEFAULT_FROM_EMAIL
  const fromName = overrides?.fromName || data?.default_from_name || DEFAULT_FROM_NAME

  // Reply-To : si le workspace a un domaine custom, route vers reply.{domain}
  // pour que le webhook inbound capte les réponses. Sinon, pas de reply-to
  // (SES fallback noreply@closrm.fr accepte déjà les réponses directement).
  const replyTo = overrides?.replyTo
    || (data?.domain ? `reply@${getInboundSubdomain(data.domain)}` : undefined)

  return { fromEmail, fromName, replyTo }
}

export const SENDER_FALLBACK_EMAIL = DEFAULT_FROM_EMAIL
export const SENDER_FALLBACK_NAME = DEFAULT_FROM_NAME
