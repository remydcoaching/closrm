import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * ClosRM ne lit pas Instagram : cette action représente une déclaration
 * manuelle du setter ("le prospect a répondu"). Réutilisée par la route
 * POST /api/leads/[id]/dm-reply (fiche lead, indépendant de toute session)
 * et par le PATCH d'un item de session DM (outcome 'replied'), pour ne pas
 * dupliquer la logique entre les deux points d'entrée.
 */
export async function markConversationActive(
  supabase: SupabaseClient,
  workspaceId: string,
  leadId: string
): Promise<{ error: string | null }> {
  const { error: leadError } = await supabase
    .from('leads')
    .update({ dm_conversation_active_at: new Date().toISOString() })
    .eq('id', leadId)

  if (leadError) {
    return { error: 'Impossible de mettre à jour le lead' }
  }

  const { error: followUpError } = await supabase
    .from('follow_ups')
    .update({ status: 'annule' })
    .eq('lead_id', leadId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'en_attente')

  if (followUpError) {
    return { error: "Impossible d'annuler les relances en attente" }
  }

  return { error: null }
}
