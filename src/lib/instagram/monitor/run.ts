// One pass of the publication monitor for one workspace (modèle Insyder):
//  1. list the coach's latest posts + reels (2 requests),
//  2. re-read likers (and comments, only when their counter moved) of the
//     publications that are due, within the day's request budget,
//  3. store every gesture not seen before (instagram_engagement_observations)
//     with the interval it appeared in, and add the ones by known leads to
//     instagram_interactions (score, parcours, audience).
// Hiker is paid: a result that can't be written is kept on the run row
// (metadata.backup) instead of being lost.
import type { SupabaseClient } from '@supabase/supabase-js'
import { estimatedBilledRequests, type HikerCallLogEntry, type HikerClient } from '@/lib/hiker/client'
import { HikerApiError } from '@/lib/hiker/errors'
import { shortcodeToMediaId } from '@/lib/instagram/shortcode'
import { dedupeContents, normalizeContent, type NormalizedContent } from '@/lib/hiker/normalizer'
import type { HikerUserShort } from '@/lib/hiker/types'
import {
  MAX_COMMENT_PAGES,
  needsCommentsRead,
  newGestures,
  observationKey,
  pickDueByLikes,
  pickDueContents,
  remainingBudget,
  scanIntervalMs,
  type MonitoredContent,
  type ObservedGesture,
} from './policy'

export type MonitorTrigger = 'cron' | 'manual'

export interface MonitorOutcome {
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'
  reason: string | null
  requests: number
  contentsListed: number
  contentsScanned: number
  newLikes: number
  newComments: number
  leadsMatched: number
}

const STOP_CATEGORIES = new Set(['INSUFFICIENT_FUNDS', 'AUTH_ERROR', 'RATE_LIMIT'])
const CONCURRENCY = 3

const skipped = (reason: string): MonitorOutcome => ({ status: 'SKIPPED', reason, requests: 0, contentsListed: 0, contentsScanned: 0, newLikes: 0, newComments: 0, leadsMatched: 0 })

function userOf(u: HikerUserShort | undefined): { id: string; username: string; fullName: string | null; pic: string | null } | null {
  const id = u?.pk ?? u?.id
  if (!u || id == null || !u.username) return null
  return { id: String(id), username: u.username, fullName: u.full_name ?? null, pic: u.profile_pic_url ?? null }
}

export async function requestsUsedToday(supabase: SupabaseClient, workspaceId: string, now = new Date()): Promise<number> {
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const { data } = await supabase.from('instagram_monitor_runs').select('requests').eq('workspace_id', workspaceId).gte('started_at', midnight)
  return (data ?? []).reduce((s, r) => s + (r.requests ?? 0), 0)
}

export async function runMonitor(
  supabase: SupabaseClient,
  workspaceId: string,
  makeClient: (onCall: (e: HikerCallLogEntry) => void) => HikerClient,
  trigger: MonitorTrigger,
  /** History backfill: read the likers of every never-read publication, up to this many requests (confirmed by the coach). */
  opts: { budgetOverride?: number } = {},
): Promise<MonitorOutcome> {
  const { data: settings } = await supabase.from('instagram_monitor_settings').select('*').eq('workspace_id', workspaceId).maybeSingle()
  if (!settings?.enabled && trigger === 'cron') return skipped('disabled')
  const maxPerDay = settings?.max_requests_per_day ?? 50
  const budget = opts.budgetOverride ?? remainingBudget(maxPerDay, await requestsUsedToday(supabase, workspaceId))

  // With the Meta API connected, comments come from the nightly Meta sync
  // (free, exact dates): Hiker only reads likers — what Meta never gives.
  const { data: igAccount } = await supabase.from('ig_accounts').select('is_connected').eq('workspace_id', workspaceId).maybeSingle()
  const commentsFromMeta = !!igAccount?.is_connected
  // Without Meta, listing the publications costs 2 requests before any read.
  if (budget < (commentsFromMeta ? 1 : 3)) return skipped('budget')

  let username = settings?.instagram_username as string | null
  if (!username) {
    const { data: ws } = await supabase.from('workspaces').select('instagram_username').eq('id', workspaceId).maybeSingle()
    username = ws?.instagram_username ?? null
  }
  if (!username) return skipped('no_account')

  let requests = 0
  const client = makeClient((e) => {
    requests += estimatedBilledRequests(e.endpoint)
  })
  const { data: run } = await supabase.from('instagram_monitor_runs').insert({ workspace_id: workspaceId, trigger }).select('id').single()
  const out: MonitorOutcome = { status: 'COMPLETED', reason: null, requests: 0, contentsListed: 0, contentsScanned: 0, newLikes: 0, newComments: 0, leadsMatched: 0 }
  const errors: string[] = []
  let backup: ObservedGesture[] | null = null

  try {
    // ── 1. The publications ──
    // Meta connected: the list (every reel, trial reels included) and the
    // exact like counts come free from the nightly Meta sync (ig_reels).
    // Otherwise: Hiker's latest posts + reels (2 requests).
    if (commentsFromMeta) {
      const { data: reels, error: reelsErr } = await supabase
        .from('ig_reels')
        .select('shortcode, permalink, thumbnail_url, caption, published_at, likes, comments')
        .eq('workspace_id', workspaceId)
        .not('shortcode', 'is', null)
        .limit(2000)
      if (reelsErr) throw new Error(`ig_reels: ${reelsErr.message}`)
      const rows = (reels ?? [])
        .map((r) => ({
          workspace_id: workspaceId,
          content_id: shortcodeToMediaId(r.shortcode as string),
          content_type: 'clip',
          content_url: r.permalink,
          thumbnail_url: r.thumbnail_url,
          caption: r.caption?.slice(0, 2000) ?? null,
          published_at: r.published_at,
          reported_like_count: r.likes,
          reported_comment_count: r.comments,
        }))
        .filter((r) => r.content_id)
      out.contentsListed = rows.length
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('instagram_monitored_contents').upsert(rows.slice(i, i + 500), { onConflict: 'workspace_id,content_id' })
        if (error) errors.push(`contents: ${error.message}`)
      }
    }
    let userId = settings?.instagram_user_id as string | null
    if (!commentsFromMeta && (!userId || settings?.instagram_username !== username)) {
      const profile = await client.getUserByUsername(username)
      userId = String(profile.pk ?? profile.id ?? '')
      if (!userId) throw new Error('Compte Instagram introuvable')
      await supabase
        .from('instagram_monitor_settings')
        .upsert({ workspace_id: workspaceId, instagram_username: username, instagram_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' })
    }
    const [medias, clips] = commentsFromMeta
      ? [{ items: [] }, { items: [] }]
      : await Promise.all([client.getUserMediaChunkPage(userId as string, null), client.getUserClipsChunkPage(userId as string, null)])
    const listed: NormalizedContent[] = dedupeContents([
      ...medias.items.map((i) => normalizeContent(i, 'media', username as string)),
      ...clips.items.map((i) => normalizeContent(i, 'clip', username as string)),
    ].filter((c): c is NormalizedContent => !!c))
    if (!commentsFromMeta) out.contentsListed = listed.length
    if (listed.length > 0) {
      // Listing columns only: the scan state of known publications is kept.
      const { error } = await supabase.from('instagram_monitored_contents').upsert(
        listed.map((c) => ({
          workspace_id: workspaceId,
          content_id: c.id,
          content_type: c.type,
          content_url: c.url,
          thumbnail_url: c.rawMetadata.thumbnail_url ?? null,
          caption: c.rawMetadata.caption_text?.slice(0, 2000) ?? null,
          published_at: c.timestamp,
          reported_like_count: c.likeCount,
          reported_comment_count: c.commentCount,
        })),
        { onConflict: 'workspace_id,content_id' },
      )
      if (error) errors.push(`contents: ${error.message}`)
    }

    // ── 2. Due publications within the budget left ──
    const COLS = 'content_id, published_at, next_scan_at, reported_like_count, reported_comment_count, comments_read_at_count, last_scanned_at, last_status, likers_seen, comments_seen'
    let allRes = await supabase.from('instagram_monitored_contents').select(`${COLS}, likes_read_at_count`).eq('workspace_id', workspaceId).limit(2000)
    // Migration 122 not applied: no like-driven selection, fall back to the schedule.
    const likesTracked = !(allRes.error && /likes_read_at_count/.test(allRes.error.message))
    if (!likesTracked) allRes = (await supabase.from('instagram_monitored_contents').select(COLS).eq('workspace_id', workspaceId).limit(2000)) as typeof allRes
    const all = allRes.data
    const now = Date.now()
    const due =
      commentsFromMeta && likesTracked
        ? pickDueByLikes((all ?? []) as MonitoredContent[], Math.max(0, budget - requests))
        : pickDueContents((all ?? []) as MonitoredContent[], now, Math.max(0, budget - requests), commentsFromMeta)
    const stateOf = new Map(((all ?? []) as (MonitoredContent & { likers_seen: number; comments_seen: number })[]).map((c) => [c.content_id, c]))

    const known = new Set<string>()
    for (let i = 0; i < due.length; i += 100) {
      const ids = due.slice(i, i + 100).map((c) => c.content_id)
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from('instagram_engagement_observations')
          .select('content_id, interaction_type, instagram_user_id, dedup_key')
          .eq('workspace_id', workspaceId)
          .in('content_id', ids)
          .range(from, from + 999)
        for (const r of data ?? []) known.add(observationKey({ contentId: r.content_id, type: r.interaction_type, instagramUserId: r.instagram_user_id, dedupKey: r.dedup_key }))
        if (!data || data.length < 1000) break
      }
    }

    // ── 3. Read likers / comments ──
    const observed: ObservedGesture[] = []
    const scanned: { c: MonitoredContent; status: 'ok' | 'error' | 'not_found'; error: string | null; commentsRead: boolean }[] = []
    let stop: string | null = null
    let next = 0
    const worker = async () => {
      while (next < due.length && !stop) {
        const c = due[next++]
        const likers = await client.getMediaLikers(c.content_id)
        if (likers.category !== 'OK') {
          if (STOP_CATEGORIES.has(likers.category)) stop = likers.category
          scanned.push({ c, status: likers.category === 'NOT_FOUND' ? 'not_found' : 'error', error: `likers ${likers.category} (${likers.status})`, commentsRead: false })
          continue
        }
        for (const u of likers.users) {
          const p = userOf(u)
          if (p) observed.push({ contentId: c.content_id, type: 'like', instagramUserId: p.id, username: p.username, fullName: p.fullName, profilePicUrl: p.pic, dedupKey: '', commentText: null, commentedAt: null })
        }
        let commentsRead = false
        let commentError: string | null = null
        if (needsCommentsRead(c, commentsFromMeta)) {
          let pageId: string | null = null
          for (let page = 0; page < MAX_COMMENT_PAGES; page++) {
            const res = await client.getMediaCommentsPage(c.content_id, pageId)
            if (res.category !== 'OK') {
              if (STOP_CATEGORIES.has(res.category)) stop = res.category
              // Comments turned off / unavailable: likers still count, not an error.
              if (res.category !== 'NOT_FOUND') commentError = `comments ${res.category} (${res.status})`
              break
            }
            for (const cm of res.comments) {
              const p = userOf(cm.user)
              if (!p || !cm.pk) continue
              const at = typeof cm.created_at === 'number' ? new Date(cm.created_at * 1000) : null
              observed.push({
                contentId: c.content_id,
                type: 'comment',
                instagramUserId: p.id,
                username: p.username,
                fullName: p.fullName,
                profilePicUrl: p.pic,
                dedupKey: String(cm.pk),
                commentText: cm.text?.slice(0, 2000) ?? null,
                commentedAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
              })
            }
            if (!res.nextPageId) {
              commentsRead = true
              break
            }
            pageId = res.nextPageId
            if (page === MAX_COMMENT_PAGES - 1) commentsRead = true // newest pages read; older ones were read before
          }
        }
        scanned.push({ c, status: commentError ? 'error' : 'ok', error: commentError, commentsRead })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    out.contentsScanned = scanned.length
    if (stop) {
      out.status = 'PARTIAL'
      out.reason = stop
    }

    // ── 4. New gestures → observations (+ leads) ──
    const fresh = newGestures(observed, known)
    const nowIso = new Date(now).toISOString()
    const prevScan = new Map(due.map((c) => [c.content_id, c.last_scanned_at]))
    const leadOf = await matchLeads(supabase, workspaceId, fresh)
    out.leadsMatched = new Set([...leadOf.values()].map((l) => l.id)).size

    const rows = fresh.map((g) => ({
      workspace_id: workspaceId,
      content_id: g.contentId,
      interaction_type: g.type,
      instagram_user_id: g.instagramUserId,
      instagram_username: g.username,
      full_name: g.fullName,
      profile_pic_url: g.profilePicUrl,
      dedup_key: g.dedupKey,
      comment_text: g.commentText,
      commented_at: g.commentedAt,
      first_observed_at: nowIso,
      previous_scan_at: prevScan.get(g.contentId) ?? null,
      matched_lead_id: leadOf.get(g.instagramUserId)?.id ?? null,
    }))
    let obsFailed = false
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from('instagram_engagement_observations')
        .upsert(rows.slice(i, i + 500), { onConflict: 'workspace_id,content_id,interaction_type,instagram_user_id,dedup_key', ignoreDuplicates: true })
      if (error) {
        obsFailed = true
        errors.push(`observations: ${error.message}`)
      }
    }
    if (obsFailed) backup = fresh
    out.newLikes = fresh.filter((g) => g.type === 'like').length
    out.newComments = fresh.filter((g) => g.type === 'comment').length

    const published = new Map(((all ?? []) as MonitoredContent[]).map((c) => [c.content_id, c.published_at]))
    errors.push(...(await addLeadInteractions(supabase, workspaceId, fresh, leadOf, prevScan, published, nowIso)))

    // ── 5. Scan state ──
    const counts = new Map<string, { likes: number; comments: number }>()
    for (const g of fresh) {
      const e = counts.get(g.contentId) ?? { likes: 0, comments: 0 }
      if (g.type === 'like') e.likes += 1
      else e.comments += 1
      counts.set(g.contentId, e)
    }
    for (let i = 0; i < scanned.length; i += 10) {
      await Promise.all(
        scanned.slice(i, i + 10).map(({ c, status, error, commentsRead }) => {
          const prev = stateOf.get(c.content_id)
          const n = counts.get(c.content_id) ?? { likes: 0, comments: 0 }
          return supabase
            .from('instagram_monitored_contents')
            .update({
              last_scanned_at: status === 'ok' || n.likes > 0 ? nowIso : c.last_scanned_at,
              next_scan_at: new Date(now + (status === 'error' ? 3_600_000 : scanIntervalMs(c.published_at, now))).toISOString(),
              last_status: status,
              last_error: error,
              likers_seen: (prev?.likers_seen ?? 0) + n.likes,
              comments_seen: (prev?.comments_seen ?? 0) + n.comments,
              ...(commentsRead ? { comments_read_at_count: c.reported_comment_count } : {}),
              ...(status === 'ok' && likesTracked ? { likes_read_at_count: c.reported_like_count ?? null } : {}),
            })
            .eq('workspace_id', workspaceId)
            .eq('content_id', c.content_id)
        }),
      )
    }
    if (errors.length > 0 && out.status === 'COMPLETED') out.status = 'PARTIAL'
  } catch (err) {
    out.status = 'FAILED'
    out.reason = err instanceof HikerApiError ? err.category : err instanceof Error ? err.message : 'Erreur inconnue'
  }

  out.requests = requests
  if (run?.id) {
    await supabase
      .from('instagram_monitor_runs')
      .update({
        completed_at: new Date().toISOString(),
        status: out.status,
        requests: out.requests,
        contents_listed: out.contentsListed,
        contents_scanned: out.contentsScanned,
        new_likes: out.newLikes,
        new_comments: out.newComments,
        leads_matched: out.leadsMatched,
        stopped_reason: out.reason,
        metadata: { errors: errors.slice(0, 20), ...(backup ? { backup } : {}) },
      })
      .eq('id', run.id)
  }
  return out
}

interface LeadRef {
  id: string
  hasPic: boolean
}

/** Existing leads for the observed people: by Instagram id, then by handle for leads without an id. */
async function matchLeads(supabase: SupabaseClient, workspaceId: string, gestures: ObservedGesture[]): Promise<Map<string, LeadRef>> {
  const byUser = new Map<string, LeadRef>()
  const ids = [...new Set(gestures.map((g) => g.instagramUserId))]
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_user_id, instagram_profile_pic_url')
      .eq('workspace_id', workspaceId)
      .in('instagram_user_id', ids.slice(i, i + 200))
    for (const l of data ?? []) if (l.instagram_user_id) byUser.set(l.instagram_user_id, { id: l.id, hasPic: !!l.instagram_profile_pic_url })
  }
  const handleToUser = new Map<string, string>()
  for (const g of gestures) if (!byUser.has(g.instagramUserId)) handleToUser.set(g.username.toLowerCase(), g.instagramUserId)
  const handles = [...handleToUser.keys()]
  for (let i = 0; i < handles.length; i += 200) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_handle, instagram_user_id, instagram_profile_pic_url')
      .eq('workspace_id', workspaceId)
      .is('instagram_user_id', null)
      .in('instagram_handle', handles.slice(i, i + 200))
    for (const l of data ?? []) {
      const uid = handleToUser.get(String(l.instagram_handle).toLowerCase())
      if (!uid || byUser.has(uid)) continue
      byUser.set(uid, { id: l.id, hasPic: !!l.instagram_profile_pic_url })
      await supabase.from('leads').update({ instagram_user_id: uid }).eq('workspace_id', workspaceId).eq('id', l.id)
    }
  }
  // Fresh profile picture for leads that have none.
  const pics = new Map(gestures.filter((g) => g.profilePicUrl).map((g) => [g.instagramUserId, g.profilePicUrl as string]))
  for (const [uid, lead] of byUser) {
    const pic = pics.get(uid)
    if (!lead.hasPic && pic) await supabase.from('leads').update({ instagram_profile_pic_url: pic }).eq('workspace_id', workspaceId).eq('id', lead.id)
  }
  return byUser
}

/** A like has no date: first pass → the publication date (lower bound); later passes → observation time, with the interval in metadata. */
export function interactionDate(g: ObservedGesture, previousScan: string | null, publishedAt: string | null, now: string): string {
  if (g.type === 'comment' && g.commentedAt) return g.commentedAt
  if (!previousScan) return publishedAt ?? now
  return now
}

async function addLeadInteractions(
  supabase: SupabaseClient,
  workspaceId: string,
  fresh: ObservedGesture[],
  leadOf: Map<string, LeadRef>,
  prevScan: Map<string, string | null>,
  published: Map<string, string | null>,
  now: string,
): Promise<string[]> {
  const byLead = fresh.filter((g) => leadOf.has(g.instagramUserId))
  if (byLead.length === 0) return []
  // One interaction per (lead, type, publication) — the dedup index of 092.
  const existing = new Set<string>()
  const leadIds = [...new Set(byLead.map((g) => (leadOf.get(g.instagramUserId) as LeadRef).id))]
  const contentIds = [...new Set(byLead.map((g) => g.contentId))]
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data } = await supabase
      .from('instagram_interactions')
      .select('lead_id, interaction_type, source_post_id')
      .eq('workspace_id', workspaceId)
      .in('lead_id', leadIds.slice(i, i + 200))
      .in('source_post_id', contentIds)
    for (const r of data ?? []) existing.add(`${r.lead_id}|${r.interaction_type}|${r.source_post_id}`)
  }
  const rows: Record<string, unknown>[] = []
  for (const g of byLead) {
    const leadId = (leadOf.get(g.instagramUserId) as LeadRef).id
    const k = `${leadId}|${g.type}|${g.contentId}`
    if (existing.has(k)) continue
    existing.add(k)
    const at = interactionDate(g, prevScan.get(g.contentId) ?? null, published.get(g.contentId) ?? null, now)
    rows.push({
      workspace_id: workspaceId,
      lead_id: leadId,
      interaction_type: g.type,
      instagram_user_id: g.instagramUserId,
      instagram_username: g.username,
      full_name: g.fullName,
      profile_url: `https://instagram.com/${g.username}`,
      source_post_id: g.contentId,
      source_provider: 'hiker',
      first_seen_at: at,
      last_seen_at: at,
      metadata: {
        monitor: true,
        dated_by: g.type === 'comment' && g.commentedAt ? 'instagram' : prevScan.get(g.contentId) ? 'scan_interval' : 'publication',
        observed_between: prevScan.get(g.contentId) ? { from: prevScan.get(g.contentId), to: now } : null,
        ...(g.commentText ? { comment_text: g.commentText } : {}),
      },
    })
  }
  const errors: string[] = []
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('instagram_interactions').insert(rows.slice(i, i + 500))
    if (error) errors.push(`interactions: ${error.message}`)
  }
  return errors
}
