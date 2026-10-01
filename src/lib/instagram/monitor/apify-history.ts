// Likes history read once with Apify — for when the HikerAPI balance is empty. Recorded exactly like a monitor pass
// (saveScan): likers become observations, known leads get the like in their
// journey, and every reel read is stamped with Meta's like count, so the
// daily Hiker pass afterwards only re-reads reels whose likes grow.
// Instagram returns a ranked slice of ~200 likers per reel: same limit as Hiker.
import type { SupabaseClient } from '@supabase/supabase-js'
import { shortcodeToMediaId } from '@/lib/instagram/shortcode'
import type { ObservedGesture } from './policy'
import { listReelsFromMeta, loadKnown, loadMonitored, saveScan, type ScannedContent } from './run'

const APIFY = 'https://api.apify.com/v2'

// Likers actors and their input. A FREE Apify account is restricted by some
// of them (memo23: « 1 post and a few likers », publicsignallabs: 1 post /
// 200 likers per run) — datadoping runs the full list.
export const APIFY_LIKERS_ACTORS = {
  datadoping: { id: 'datadoping~instagram-likes-scraper', input: (urls: string[]) => ({ posts: urls, max_count: 1000 }) },
  memo23: { id: 'memo23~instagram-likers-scraper', input: (urls: string[]) => ({ postUrls: urls, includeHistorical: false }) },
} as const
export type ApifyLikersActor = keyof typeof APIFY_LIKERS_ACTORS

/** A liker row, in either actor's format (camelCase: memo23, snake_case: datadoping). */
export interface ApifyLiker {
  userId?: string | number | null
  id?: string | number | null
  username?: string | null
  fullName?: string | null
  full_name?: string | null
  profilePicUrl?: string | null
  profile_pic_url?: string | null
  sourceShortCode?: string | null
  sourceMediaPk?: string | number | null
  sourcePostUrl?: string | null
  liked_post?: string | null
}

type Monitored = Awaited<ReturnType<typeof loadMonitored>>['all'][number]

/** Pure: the reels a history read should cover — never read, with likes on Meta, newest first. */
export function historyTargets(all: Monitored[]): Monitored[] {
  return all
    .filter((c) => c.last_scanned_at === null && c.last_status !== 'not_found' && (c.reported_like_count ?? 0) > 0)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
}

const codeFromUrl = (url: string | null | undefined) => url?.match(/\/(?:p|reels?)\/([A-Za-z0-9_-]+)/)?.[1] ?? null

/** Pure: Apify rows → like gestures keyed by the media pk (same ids as Hiker and the Content page). */
export function gesturesFromApify(items: ApifyLiker[]): ObservedGesture[] {
  const out: ObservedGesture[] = []
  for (const it of items) {
    const code = it.sourceShortCode || codeFromUrl(it.sourcePostUrl ?? it.liked_post)
    const contentId = (it.sourceMediaPk ? String(it.sourceMediaPk) : '') || (code ? shortcodeToMediaId(code) : '')
    const userId = it.userId ?? it.id
    if (!contentId || !userId || !it.username) continue
    out.push({
      contentId,
      type: 'like',
      instagramUserId: String(userId),
      username: it.username,
      fullName: it.fullName ?? it.full_name ?? null,
      profilePicUrl: it.profilePicUrl ?? it.profile_pic_url ?? null,
      dedupKey: '',
      commentText: null,
      commentedAt: null,
    })
  }
  return out
}

async function apify<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${APIFY}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!res.ok) throw new Error(`Apify ${path.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

/** Starts the run; Apify stops it once `maxChargeUsd` is spent (pay-per-event actor). */
export async function startApifyLikersRun(token: string, actor: ApifyLikersActor, postUrls: string[], maxChargeUsd: number): Promise<string> {
  const { id, input } = APIFY_LIKERS_ACTORS[actor]
  const body = await apify<{ data: { id: string } }>(token, `/acts/${id}/runs?maxTotalChargeUsd=${maxChargeUsd}`, {
    method: 'POST',
    body: JSON.stringify(input(postUrls)),
  })
  return body.data.id
}

export interface ApifyRunState {
  status: string
  datasetId: string | null
  usageUsd: number | null
}

export async function getApifyRun(token: string, runId: string): Promise<ApifyRunState> {
  const { data } = await apify<{ data: { status: string; defaultDatasetId?: string; usageTotalUsd?: number } }>(token, `/actor-runs/${runId}`)
  return { status: data.status, datasetId: data.defaultDatasetId ?? null, usageUsd: data.usageTotalUsd ?? null }
}

export async function fetchApifyLikers(token: string, datasetId: string): Promise<ApifyLiker[]> {
  const items: ApifyLiker[] = []
  for (let offset = 0; ; offset += 1000) {
    const page = await apify<ApifyLiker[]>(token, `/datasets/${datasetId}/items?clean=true&format=json&offset=${offset}&limit=1000`)
    items.push(...page)
    if (page.length < 1000) break
  }
  return items
}

export interface HistoryImport {
  reelsRead: number
  newLikes: number
  leadsMatched: number
  errors: string[]
}

/**
 * Records the Apify likers as a monitor pass. Only reels with at least one
 * liker returned are marked read: a reel the run didn't reach (spending cap)
 * stays unread for the Hiker monitor.
 */
export async function importApifyLikers(
  supabase: SupabaseClient,
  workspaceId: string,
  items: ApifyLiker[],
  meta: { actor: ApifyLikersActor; runId: string; usageUsd: number | null },
): Promise<HistoryImport> {
  const listing = await listReelsFromMeta(supabase, workspaceId)
  const { all, likesTracked } = await loadMonitored(supabase, workspaceId)
  const observed = gesturesFromApify(items)
  const readIds = new Set(observed.map((g) => g.contentId))
  const byId = new Map(all.map((c) => [c.content_id, c]))
  const scanned: ScannedContent[] = [...readIds].flatMap((id) => {
    const c = byId.get(id)
    return c ? [{ c, status: 'ok' as const, error: null, commentsRead: false }] : []
  })
  const known = await loadKnown(supabase, workspaceId, [...readIds])
  const now = Date.now()
  const saved = await saveScan(supabase, workspaceId, { scanned, observed: observed.filter((g) => byId.has(g.contentId)), known, all, now, likesTracked })
  const errors = [...listing.errors, ...saved.errors]

  await supabase.from('instagram_monitor_runs').insert({
    workspace_id: workspaceId,
    trigger: 'manual',
    started_at: new Date(now).toISOString(),
    completed_at: new Date().toISOString(),
    status: errors.length > 0 ? 'PARTIAL' : 'COMPLETED',
    // Not Hiker requests: the daily Hiker budget is untouched.
    requests: 0,
    contents_listed: listing.listed,
    contents_scanned: scanned.length,
    new_likes: saved.newLikes,
    new_comments: 0,
    leads_matched: saved.leadsMatched,
    stopped_reason: null,
    metadata: { provider: 'apify', actor: APIFY_LIKERS_ACTORS[meta.actor].id, apify_run_id: meta.runId, cost_usd: meta.usageUsd, likers_returned: items.length, errors: errors.slice(0, 20), ...(saved.backup ? { backup: saved.backup } : {}) },
  })
  return { reelsRead: scanned.length, newLikes: saved.newLikes, leadsMatched: saved.leadsMatched, errors }
}
