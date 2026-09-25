// Loads every lead with at least one Instagram interaction, with the fields
// audience-segments.ts needs plus display fields for drill-down lists.
// Shared by GET /api/instagram/audience (counts) and
// GET /api/instagram/audience/leads (rows) so both always agree.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngagedLead } from './audience-segments'

export interface EngagedLeadRow extends EngagedLead {
  first_name: string
  last_name: string
  instagram_handle: string | null
  instagram_profile_pic_url: string | null
  status: string
  interactionsCount: number
}

const PAGE = 1000
const CHUNK = 200

export async function loadEngagedLeads(supabase: SupabaseClient, workspaceId: string): Promise<EngagedLeadRow[]> {
  const lastSeenByLead = new Map<string, string>()
  const countByLead = new Map<string, number>()
  // Paged: PostgREST caps a single response at 1000 rows.
  for (let from = 0; ; from += PAGE) {
    const { data: rows, error } = await supabase
      .from('instagram_interactions')
      .select('lead_id, last_seen_at')
      .eq('workspace_id', workspaceId)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const row of rows ?? []) {
      const prev = lastSeenByLead.get(row.lead_id)
      if (!prev || row.last_seen_at > prev) lastSeenByLead.set(row.lead_id, row.last_seen_at)
      countByLead.set(row.lead_id, (countByLead.get(row.lead_id) ?? 0) + 1)
    }
    if (!rows || rows.length < PAGE) break
  }

  const ids = [...lastSeenByLead.keys()]
  const result: EngagedLeadRow[] = []
  // Chunked .in(): thousands of ids in one query string overflow the URL.
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const [leadsRes, profilesRes, dmRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, first_name, last_name, instagram_handle, instagram_profile_pic_url, status, call_attempts, dm_conversation_active_at')
        .eq('workspace_id', workspaceId)
        .in('id', chunk),
      supabase
        .from('discovery_profiles')
        .select('matched_lead_id, follows_target, created_at')
        .eq('workspace_id', workspaceId)
        .in('matched_lead_id', chunk)
        .order('created_at', { ascending: false }),
      supabase.from('dm_session_items').select('lead_id').in('lead_id', chunk).in('outcome', ['relaunched', 'replied']),
    ])
    if (leadsRes.error) throw new Error(leadsRes.error.message)

    const followsByLead = new Map<string, boolean>()
    for (const p of profilesRes.data ?? []) {
      if (p.matched_lead_id && !followsByLead.has(p.matched_lead_id)) followsByLead.set(p.matched_lead_id, p.follows_target)
    }
    const dmSent = new Set((dmRes.data ?? []).map((d) => d.lead_id as string))

    for (const l of leadsRes.data ?? []) {
      result.push({
        id: l.id,
        first_name: l.first_name,
        last_name: l.last_name,
        instagram_handle: l.instagram_handle,
        instagram_profile_pic_url: l.instagram_profile_pic_url,
        status: l.status,
        interactionsCount: countByLead.get(l.id) ?? 0,
        lastSeenAt: lastSeenByLead.get(l.id)!,
        callAttempts: l.call_attempts ?? 0,
        dmConversationActiveAt: l.dm_conversation_active_at ?? null,
        dmSent: dmSent.has(l.id),
        followsTarget: followsByLead.get(l.id) ?? null,
      })
    }
  }
  return result
}

export function parsePeriodDays(raw: string | null, fallback = 7): number {
  return Math.min(Math.max(Number(raw) || fallback, 1), 365)
}
