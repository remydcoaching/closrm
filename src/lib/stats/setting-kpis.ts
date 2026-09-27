import { createClient } from '@/lib/supabase/server'

export interface SettingKpis {
  callsBookes: number
  nouveauxLeads: number
  totalConvIg: number
  totalRepIg: number
  tauxReponse: number | null // null si 0 conversation
}

function getSinceIso(period: number): string | null {
  if (period === 0) return null
  const since = new Date()
  since.setDate(since.getDate() - period)
  return since.toISOString()
}

/**
 * KPIs setting calculés à partir des données réellement produites par les
 * sessions DM — remplace le suivi manuel sur Google Sheet. Aucune table
 * dédiée : "conversation initiée" = un dm_session_item avec un outcome sur
 * la période, "a répondu" = leads.dm_conversation_active_at renseigné sur
 * la période. ClosRM ne lit pas Instagram : ces deux signaux sont ce que le
 * setter déclare manuellement dans le CRM, pas une mesure directe des DM.
 */
export async function fetchSettingKpis(workspaceId: string, period: number): Promise<SettingKpis> {
  const supabase = await createClient()
  const since = getSinceIso(period)

  let callsQuery = supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) callsQuery = callsQuery.gte('created_at', since)

  let leadsQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (since) leadsQuery = leadsQuery.gte('created_at', since)

  let convQuery = supabase
    .from('dm_session_items')
    .select('id, session:dm_sessions!inner(workspace_id)', { count: 'exact', head: true })
    .eq('session.workspace_id', workspaceId)
    .not('outcome', 'is', null)
  if (since) convQuery = convQuery.gte('updated_at', since)

  let repliedQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .not('dm_conversation_active_at', 'is', null)
  if (since) repliedQuery = repliedQuery.gte('dm_conversation_active_at', since)

  const [callsRes, leadsRes, convRes, repliedRes] = await Promise.all([
    callsQuery,
    leadsQuery,
    convQuery,
    repliedQuery,
  ])

  const totalConvIg = convRes.count ?? 0
  const totalRepIg = repliedRes.count ?? 0

  return {
    callsBookes: callsRes.count ?? 0,
    nouveauxLeads: leadsRes.count ?? 0,
    totalConvIg,
    totalRepIg,
    tauxReponse: totalConvIg > 0 ? Math.round((totalRepIg / totalConvIg) * 1000) / 10 : null,
  }
}
