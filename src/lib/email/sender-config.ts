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

const DEFAULT_FROM_EMAIL = 'noreply@closrm.fr'
const DEFAULT_FROM_NAME = 'ClosRM'

export interface SenderConfig {
  fromEmail: string
  fromName: string
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
    return { fromEmail: overrides.fromEmail, fromName: overrides.fromName }
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('email_domains')
    .select('default_from_email, default_from_name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .not('default_from_email', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return {
    fromEmail: overrides?.fromEmail || data?.default_from_email || DEFAULT_FROM_EMAIL,
    fromName: overrides?.fromName || data?.default_from_name || DEFAULT_FROM_NAME,
  }
}
