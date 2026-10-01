// Supabase loaders behind the Content page — chart points and per-content
// detail. See content-metrics.ts for how figures are derived.
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoreLeads } from '@/lib/leads/engagement-score'
import { confidenceLevel, type ConfidenceLevel } from '@/lib/leads/confidence'
import { applyMeta, buildContentMetrics, latestPerContent, rowFromMeta, withMeta, type ContentMetrics, type DiscoveryContentRow, type MetaReelRow, type ObservedCounts } from './content-metrics'
import { mediaIdToShortcode, shortcodeToMediaId } from './shortcode'

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

// ─── Official Meta figures (ig_reels, nightly sync) ───────────────────────
const META_COLS = 'ig_media_id, shortcode, permalink, caption, thumbnail_url, views, likes, comments, reach, saves, shares, published_at, is_shared_to_feed'
// Columns of migrations that may not be applied yet, dropped from the select when missing.
const OPTIONAL_META_COLS: [RegExp, string][] = [
  [/is_shared_to_feed/, ', is_shared_to_feed'],
  [/shortcode|permalink/, ', shortcode, permalink'],
]

/** Runs a select of META_COLS, dropping the columns of migrations not applied yet (121, 123), whatever the order Postgres reports them. */
async function selectMeta<R extends { error: { message: string } | null }>(run: (cols: string) => PromiseLike<R>): Promise<R> {
  let cols = META_COLS
  let res = await run(cols)
  for (let i = 0; i < OPTIONAL_META_COLS.length && res.error; i++) {
    const message = res.error.message
    const hit = OPTIONAL_META_COLS.find(([re, part]) => cols.includes(part) && re.test(message))
    if (!hit) break
    cols = cols.replace(hit[1], '')
    res = await run(cols)
  }
  return res
}

/**
 * Reels synced from the Meta API, keyed by shortcode — or by their Graph id
 * while the shortcode isn't filled yet (it is on the next nightly sync), so
 * the page shows them right away.
 */
async function loadMetaReels(supabase: SupabaseClient, workspaceId: string, sinceIso: string | null): Promise<Map<string, MetaReelRow>> {
  const build = (cols: string) => {
    let q = supabase.from('ig_reels').select(cols).eq('workspace_id', workspaceId)
    if (sinceIso) q = q.gte('published_at', sinceIso)
    return q.limit(1000)
  }
  const res = await selectMeta(build)
  if (res.error) return new Map()
  return new Map(((res.data ?? []) as unknown as MetaReelRow[]).map((r) => [metaKey(r), { ...r, shortcode: r.shortcode ?? null, permalink: r.permalink ?? null }]))
}

/** Map key of a Meta reel: its shortcode, or 'g:<graph id>' until the shortcode is known. */
const metaKey = (r: MetaReelRow) => r.shortcode ?? `g:${r.ig_media_id}`

/** Content id of a Meta-only publication: the media pk (from the shortcode), else the Graph id. */
const metaContentId = (r: MetaReelRow) => (r.shortcode ? shortcodeToMediaId(r.shortcode) : '') || r.ig_media_id

/** Likers identified by the publication monitor, per content (media pk). */
async function loadMonitorLikers(supabase: SupabaseClient, workspaceId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('instagram_monitored_contents').select('content_id, likers_seen').eq('workspace_id', workspaceId).gt('likers_seen', 0).limit(2000)
  if (error) return new Map() // migration 118 not applied: no monitor
  return new Map((data ?? []).map((r) => [r.content_id as string, Number(r.likers_seen)]))
}

/** Distinct commenters per Graph media id, from the comments synced via the Meta API. */
async function loadMetaCommenters(supabase: SupabaseClient, workspaceId: string, graphIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  for (let i = 0; i < graphIds.length; i += CHUNK) {
    const { data } = await supabase.from('ig_comments').select('ig_media_id, username').eq('workspace_id', workspaceId).in('ig_media_id', graphIds.slice(i, i + CHUNK))
    for (const c of data ?? []) {
      if (!c.username) continue
      const set = out.get(c.ig_media_id) ?? new Set<string>()
      set.add(String(c.username).toLowerCase())
      out.set(c.ig_media_id, set)
    }
  }
  return out
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

  // Official Meta figures on scanned contents, and the recent publications
  // Hiker never scanned (so the page is current without paying a scan).
  const [metaByCode, monitorLikers] = await Promise.all([loadMetaReels(supabase, workspaceId, sinceIso), loadMonitorLikers(supabase, workspaceId)])
  const scannedCodes = new Set(rows.map((r) => mediaIdToShortcode(r.content_id)))
  const metaOnly = [...metaByCode.entries()].filter(([code]) => !scannedCodes.has(code))
  const commenters = await loadMetaCommenters(supabase, workspaceId, [...metaByCode.values()].map((m) => m.ig_media_id))

  const fromHiker = rows.map((r) => {
    const meta = metaByCode.get(mediaIdToShortcode(r.content_id))
    const o = observed.get(r.content_id)
    const counts: ObservedCounts = {
      likers: Math.max(o?.likers ?? 0, monitorLikers.get(r.content_id) ?? 0),
      commenters: Math.max(o?.commenters ?? 0, meta ? (commenters.get(meta.ig_media_id)?.size ?? 0) : 0),
      leads: Math.max(o?.leads ?? 0, apifyLeads.get(r.content_id) ?? 0),
    }
    return withMeta(buildContentMetrics(meta ? applyMeta(r, meta) : r, counts), meta, true)
  })
  const fromMeta = metaOnly
    .map(([, meta]) => {
      const pk = metaContentId(meta)
      if (!pk) return null
      const counts: ObservedCounts = { likers: monitorLikers.get(pk) ?? 0, commenters: commenters.get(meta.ig_media_id)?.size ?? 0, leads: apifyLeads.get(pk) ?? 0 }
      return withMeta(buildContentMetrics(rowFromMeta(meta, pk), counts), meta, false)
    })
    .filter((m): m is ContentMetrics => !!m)
  return [...fromHiker, ...fromMeta]
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
  /** Comments on this publication (Meta, monitor or scan — the largest source) and the earliest text. */
  commentsCount: number
  commentText: string | null
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
  // Media pks and Graph ids are numeric; anything else can't be a content (and never reaches a filter).
  if (!/^\d{1,30}$/.test(contentId)) return null
  const raw = await selectContents((c) => supabase.from('discovery_contents').select(c).eq('workspace_id', workspaceId).eq('content_id', contentId))
  const [scanned] = latestPerContent(raw)
  // The Meta reel behind this content: by shortcode (media pk), or by Graph id
  // for a reel whose shortcode isn't synced yet.
  const code = mediaIdToShortcode(contentId)
  const metaRes = await selectMeta((cols) => {
    const q = supabase.from('ig_reels').select(cols).eq('workspace_id', workspaceId)
    // Without migration 121 there is no shortcode to match on.
    return (cols.includes('shortcode') ? q.or(`shortcode.eq.${code},ig_media_id.eq.${contentId}`) : q.eq('ig_media_id', contentId)).limit(1).maybeSingle()
  })
  const meta = (metaRes.data ?? undefined) as MetaReelRow | undefined
  if (!scanned && !meta) return null
  const row = scanned ? (meta ? applyMeta(scanned, meta) : scanned) : rowFromMeta(meta as MetaReelRow, contentId)

  const interactions = scanned ? await loadInteractions(supabase, workspaceId, [row.discovery_run_id], [contentId]) : []
  const byUser = new Map<string, ContentProfile>()
  // Comments per person and source (the same comment can be read by Meta and by Hiker): the largest count wins.
  const commentCounts = new Map<string, number[]>()
  const countComment = (username: string, source: 0 | 1 | 2, text: string | null, at: string | null, earliest: Map<string, string>) => {
    const c = commentCounts.get(username) ?? [0, 0, 0]
    c[source] += 1
    commentCounts.set(username, c)
    const p = byUser.get(username)
    if (p && text && (!p.commentText || (at && at < (earliest.get(username) ?? '\uffff')))) {
      p.commentText = text
      if (at) earliest.set(username, at)
    }
  }
  const earliestComment = new Map<string, string>()
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
        commentsCount: 0,
        commentText: null,
        totalLikes: null,
        totalComments: null,
        discoveryProfileId: null,
        runId: row.discovery_run_id,
        lead: null,
      } satisfies ContentProfile)
    if (i.interaction_type === 'like') p.liked = true
    else p.commented = true
    byUser.set(i.instagram_username, p)
    if (i.interaction_type !== 'like') countComment(i.instagram_username, 0, null, null, earliestComment)
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
        commentsCount: 0,
        commentText: null,
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

  // Likers (and Hiker comments) identified by the publication monitor or the likes history.
  const monitored: { instagram_username: string; instagram_user_id: string; full_name: string | null; profile_pic_url: string | null; interaction_type: string; matched_lead_id: string | null; comment_text: string | null; commented_at: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('instagram_engagement_observations')
      .select('instagram_username, instagram_user_id, full_name, profile_pic_url, interaction_type, matched_lead_id, comment_text, commented_at')
      .eq('workspace_id', workspaceId)
      .eq('content_id', contentId)
      .range(from, from + 999)
    if (error) break // migration 118 not applied: no monitor
    monitored.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  for (const o of monitored) {
    const p =
      byUser.get(o.instagram_username) ??
      ({
        username: o.instagram_username,
        fullName: o.full_name,
        instagramUserId: o.instagram_user_id,
        profilePicUrl: o.profile_pic_url,
        isVerified: null,
        followsTarget: null,
        liked: false,
        commented: false,
        commentsCount: 0,
        commentText: null,
        totalLikes: null,
        totalComments: null,
        discoveryProfileId: null,
        runId: null,
        lead: null,
      } satisfies ContentProfile)
    if (o.interaction_type === 'like') p.liked = true
    else p.commented = true
    p.profilePicUrl ??= o.profile_pic_url
    byUser.set(o.instagram_username, p)
    if (o.interaction_type === 'comment') countComment(o.instagram_username, 1, o.comment_text, o.commented_at, earliestComment)
  }

  // Commenters read from the Meta API (exact, free).
  if (meta) {
    const { data: metaComments } = await supabase.from('ig_comments').select('username, text, timestamp').eq('workspace_id', workspaceId).eq('ig_media_id', meta.ig_media_id)
    for (const c of metaComments ?? []) {
      if (!c.username) continue
      const p =
        byUser.get(c.username) ??
        ({
          username: c.username,
          fullName: null,
          instagramUserId: null,
          profilePicUrl: null,
          isVerified: null,
          followsTarget: null,
          liked: false,
          commented: false,
          commentsCount: 0,
          commentText: null,
          totalLikes: null,
          totalComments: null,
          discoveryProfileId: null,
          runId: null,
          lead: null,
        } satisfies ContentProfile)
      p.commented = true
      byUser.set(c.username, p)
      countComment(c.username, 2, c.text ?? null, c.timestamp ?? null, earliestComment)
    }
  }
  for (const [username, c] of commentCounts) {
    const p = byUser.get(username)
    if (p) p.commentsCount = Math.max(...c)
  }

  const usernames = [...byUser.keys()]
  const leadIds = new Set<string>((leadInteractions ?? []).map((l) => l.lead_id as string))
  const leadIdByUser = new Map<string, string>((leadInteractions ?? []).map((l) => [l.instagram_username as string, l.lead_id as string]))
  for (const o of monitored) {
    if (!o.matched_lead_id || leadIdByUser.has(o.instagram_username)) continue
    leadIds.add(o.matched_lead_id)
    leadIdByUser.set(o.instagram_username, o.matched_lead_id)
  }

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
  const metrics = withMeta(
    buildContentMetrics(row, {
      likers: profiles.filter((p) => p.liked).length,
      commenters: profiles.filter((p) => p.commented).length,
      leads: leadsCount,
    }),
    meta,
    !!scanned,
  )
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
