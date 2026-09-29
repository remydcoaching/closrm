// Supabase loaders behind the Content page — chart points and per-content
// detail. See content-metrics.ts for how figures are derived.
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoreLeads } from '@/lib/leads/engagement-score'
import { confidenceLevel, type ConfidenceLevel } from '@/lib/leads/confidence'
import { buildContentMetrics, latestPerContent, type ContentMetrics, type DiscoveryContentRow, type ObservedCounts } from './content-metrics'

const CONTENT_COLS = 'discovery_run_id, content_id, content_type, content_url, thumbnail_url, published_at, view_count, reported_like_count, reported_comment_count, created_at'

/** discovery_contents select with caption, retried without it until migration 114 is applied. */
async function selectContents(build: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  let res = await build(`${CONTENT_COLS}, caption`)
  if (res.error && /caption/.test(res.error.message)) res = await build(CONTENT_COLS)
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []) as DiscoveryContentRow[]
}

const PAGE = 1000
const CHUNK = 100

interface InteractionRow {
  discovery_run_id: string
  content_id: string
  instagram_user_id: string | null
  instagram_username: string
  full_name: string | null
  interaction_type: 'like' | 'comment'
}

// discovery_interactions (migration 110) may not be applied yet on a given
// database — the page must keep working (with 0 identified profiles).
function isMissingTable(message: string | undefined): boolean {
  return !!message && /does not exist|Could not find the table|schema cache/i.test(message)
}

async function loadInteractions(supabase: SupabaseClient, workspaceId: string, runIds: string[], contentIds?: string[]): Promise<InteractionRow[]> {
  const out: InteractionRow[] = []
  for (let i = 0; i < runIds.length; i += CHUNK) {
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('discovery_interactions')
        .select('discovery_run_id, content_id, instagram_user_id, instagram_username, full_name, interaction_type')
        .eq('workspace_id', workspaceId)
        .in('discovery_run_id', runIds.slice(i, i + CHUNK))
      if (contentIds) q = q.in('content_id', contentIds)
      const { data, error } = await q.range(from, from + PAGE - 1)
      if (error) {
        if (isMissingTable(error.message)) return []
        throw new Error(error.message)
      }
      out.push(...((data ?? []) as InteractionRow[]))
      if (!data || data.length < PAGE) break
    }
  }
  return out
}

/** username → matched lead id, per run (profiles that were already leads, or targeted since). */
async function loadMatchedLeads(supabase: SupabaseClient, workspaceId: string, runIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let i = 0; i < runIds.length; i += CHUNK) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('discovery_profiles')
        .select('discovery_run_id, instagram_username, matched_lead_id')
        .eq('workspace_id', workspaceId)
        .in('discovery_run_id', runIds.slice(i, i + CHUNK))
        .not('matched_lead_id', 'is', null)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const p of data ?? []) map.set(`${p.discovery_run_id}|${p.instagram_username}`, p.matched_lead_id as string)
      if (!data || data.length < PAGE) break
    }
  }
  return map
}

export async function loadContentMetrics(supabase: SupabaseClient, workspaceId: string, sinceIso: string | null): Promise<ContentMetrics[]> {
  const raw = await selectContents((c) => {
    let q = supabase.from('discovery_contents').select(c).eq('workspace_id', workspaceId)
    if (sinceIso) q = q.gte('published_at', sinceIso)
    return q
  })
  const rows = latestPerContent(raw)
  const runIds = [...new Set(rows.map((r) => r.discovery_run_id))]
  const latestRunByContent = new Map(rows.map((r) => [r.content_id, r.discovery_run_id]))
  const observed = new Map<string, { likers: number; commenters: number; leads: number }>()

  const [rpc, summaries] = await Promise.all([
    runIds.length > 0 ? supabase.rpc('discovery_content_observed', { p_workspace: workspaceId, p_run_ids: runIds }) : Promise.resolve({ data: [], error: null }),
    supabase.from('instagram_content_summary').select('source_post_id, leads_count').eq('workspace_id', workspaceId),
  ])

  if (!rpc.error) {
    // Grouped in Postgres (migration 114).
    for (const r of (rpc.data ?? []) as { discovery_run_id: string; content_id: string; likers: number; commenters: number; leads: number }[]) {
      if (latestRunByContent.get(r.content_id) !== r.discovery_run_id) continue
      observed.set(r.content_id, { likers: Number(r.likers), commenters: Number(r.commenters), leads: Number(r.leads) })
    }
  } else {
    // Fallback while 109 isn't deployed: group raw rows here.
    const [interactions, matched] = await Promise.all([loadInteractions(supabase, workspaceId, runIds), loadMatchedLeads(supabase, workspaceId, runIds)])
    const sets = new Map<string, { likers: Set<string>; commenters: Set<string>; leads: Set<string> }>()
    for (const i of interactions) {
      if (latestRunByContent.get(i.content_id) !== i.discovery_run_id) continue
      const o = sets.get(i.content_id) ?? { likers: new Set(), commenters: new Set(), leads: new Set() }
      ;(i.interaction_type === 'like' ? o.likers : o.commenters).add(i.instagram_username)
      const leadId = matched.get(`${i.discovery_run_id}|${i.instagram_username}`)
      if (leadId) o.leads.add(leadId)
      sets.set(i.content_id, o)
    }
    for (const [id, o] of sets) observed.set(id, { likers: o.likers.size, commenters: o.commenters.size, leads: o.leads.size })
  }
  const apifyLeads = new Map((summaries.data ?? []).map((s) => [s.source_post_id as string, s.leads_count as number]))

  return rows.map((r) => {
    const o = observed.get(r.content_id)
    const counts: ObservedCounts = {
      likers: o?.likers ?? 0,
      commenters: o?.commenters ?? 0,
      leads: Math.max(o?.leads ?? 0, apifyLeads.get(r.content_id) ?? 0),
    }
    return buildContentMetrics(r, counts)
  })
}

export interface ContentProfile {
  username: string
  fullName: string | null
  instagramUserId: string | null
  profilePicUrl: string | null
  isVerified: boolean | null
  followsTarget: boolean | null
  liked: boolean
  commented: boolean
  /** Totals across the whole scanned account (from discovery_profiles). */
  totalLikes: number | null
  totalComments: number | null
  discoveryProfileId: string | null
  runId: string | null
  lead: { id: string; firstName: string; lastName: string; status: string } | null
}

export interface ContentDetail {
  metrics: ContentMetrics
  profiles: ContentProfile[]
}

export async function loadContentDetail(supabase: SupabaseClient, workspaceId: string, contentId: string): Promise<ContentDetail | null> {
  const raw = await selectContents((c) => supabase.from('discovery_contents').select(c).eq('workspace_id', workspaceId).eq('content_id', contentId))
  const [row] = latestPerContent(raw)
  if (!row) return null

  const interactions = await loadInteractions(supabase, workspaceId, [row.discovery_run_id], [contentId])
  const byUser = new Map<string, ContentProfile>()
  for (const i of interactions) {
    const p =
      byUser.get(i.instagram_username) ??
      ({
        username: i.instagram_username,
        fullName: i.full_name,
        instagramUserId: i.instagram_user_id,
        profilePicUrl: null,
        isVerified: null,
        followsTarget: null,
        liked: false,
        commented: false,
        totalLikes: null,
        totalComments: null,
        discoveryProfileId: null,
        runId: row.discovery_run_id,
        lead: null,
      } satisfies ContentProfile)
    if (i.interaction_type === 'like') p.liked = true
    else p.commented = true
    byUser.set(i.instagram_username, p)
  }

  // Leads observed on this content through instagram_interactions (Apify).
  const { data: leadInteractions } = await supabase
    .from('instagram_interactions')
    .select('lead_id, instagram_username, instagram_user_id, full_name, interaction_type')
    .eq('workspace_id', workspaceId)
    .eq('source_post_id', contentId)
  for (const li of leadInteractions ?? []) {
    const p =
      byUser.get(li.instagram_username) ??
      ({
        username: li.instagram_username,
        fullName: li.full_name,
        instagramUserId: li.instagram_user_id,
        profilePicUrl: null,
        isVerified: null,
        followsTarget: null,
        liked: false,
        commented: false,
        totalLikes: null,
        totalComments: null,
        discoveryProfileId: null,
        runId: null,
        lead: null,
      } satisfies ContentProfile)
    if (li.interaction_type === 'like') p.liked = true
    if (li.interaction_type === 'comment') p.commented = true
    byUser.set(li.instagram_username, p)
  }

  const usernames = [...byUser.keys()]
  const leadIds = new Set<string>((leadInteractions ?? []).map((l) => l.lead_id as string))
  const leadIdByUser = new Map<string, string>((leadInteractions ?? []).map((l) => [l.instagram_username as string, l.lead_id as string]))

  for (let i = 0; i < usernames.length; i += CHUNK) {
    const { data: profiles } = await supabase
      .from('discovery_profiles')
      .select('id, instagram_username, profile_pic_url, is_verified, follows_target, likes_count, comments_count, matched_lead_id')
      .eq('workspace_id', workspaceId)
      .eq('discovery_run_id', row.discovery_run_id)
      .in('instagram_username', usernames.slice(i, i + CHUNK))
    for (const dp of profiles ?? []) {
      const p = byUser.get(dp.instagram_username)
      if (!p) continue
      p.discoveryProfileId = dp.id
      p.profilePicUrl = dp.profile_pic_url
      p.isVerified = dp.is_verified
      p.followsTarget = dp.follows_target
      p.totalLikes = dp.likes_count
      p.totalComments = dp.comments_count
      if (dp.matched_lead_id) {
        leadIds.add(dp.matched_lead_id)
        leadIdByUser.set(dp.instagram_username, dp.matched_lead_id)
      }
    }
  }

  const ids = [...leadIds]
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, first_name, last_name, status, instagram_profile_pic_url')
      .eq('workspace_id', workspaceId)
      .in('id', ids.slice(i, i + CHUNK))
    const byId = new Map((leads ?? []).map((l) => [l.id as string, l]))
    for (const [username, leadId] of leadIdByUser) {
      const l = byId.get(leadId)
      const p = byUser.get(username)
      if (l && p) {
        p.lead = { id: l.id, firstName: l.first_name, lastName: l.last_name, status: l.status }
        p.profilePicUrl ??= l.instagram_profile_pic_url
      }
    }
  }

  const profiles = [...byUser.values()]
  const leadsCount = profiles.filter((p) => p.lead).length
  const metrics = buildContentMetrics(row, {
    likers: profiles.filter((p) => p.liked).length,
    commenters: profiles.filter((p) => p.commented).length,
    leads: leadsCount,
  })
  // Commenters first (stronger intent), then by account-wide activity.
  profiles.sort((a, b) => Number(b.commented) - Number(a.commented) || (b.totalLikes ?? 0) + (b.totalComments ?? 0) - ((a.totalLikes ?? 0) + (a.totalComments ?? 0)))
  return { metrics, profiles }
}


export type ConfidenceCounts = Partial<Record<ConfidenceLevel, number>>

/**
 * Leads reached by each content, counted by confidence level (Contenu page
 * filter). Uses instagram_content_leads (migration 114); returns null when
 * that function isn't deployed yet so the UI can say so.
 */
export async function loadContentConfidence(
  supabase: SupabaseClient,
  workspaceId: string,
  runIds: string[],
): Promise<Map<string, ConfidenceCounts> | null> {
  const { data, error } = await supabase.rpc('instagram_content_leads', { p_workspace: workspaceId, p_run_ids: runIds })
  if (error) return null
  const pairs = (data ?? []) as { content_id: string; lead_id: string }[]
  const scores = await scoreLeads(supabase, workspaceId, [...new Set(pairs.map((p) => p.lead_id))])
  const out = new Map<string, ConfidenceCounts>()
  for (const p of pairs) {
    const sc = scores.get(p.lead_id)
    const level = sc ? confidenceLevel(sc) : 'insuffisant'
    const counts = out.get(p.content_id) ?? {}
    counts[level] = (counts[level] ?? 0) + 1
    out.set(p.content_id, counts)
  }
  return out
}
