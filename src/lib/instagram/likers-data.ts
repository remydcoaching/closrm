// Who likes the coach's publications (Audience page, like Insyder): every
// like the publication monitor identified (instagram_engagement_observations,
// type 'like', read with HikerAPI), grouped per Instagram account.
// Instagram never dates a like: `lastSeenAt` is when ClosRM first saw the
// latest one, never a "liked at" date.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LikeObservation {
  instagram_user_id: string
  instagram_username: string
  full_name: string | null
  profile_pic_url: string | null
  content_id: string
  first_observed_at: string
  matched_lead_id: string | null
}

export interface LikerLead {
  id: string
  first_name: string
  last_name: string
  status: string
  instagram_profile_pic_url: string | null
}

export interface LikerRow {
  instagramUserId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  /** Distinct publications liked. */
  likes: number
  lastSeenAt: string
  leadId: string | null
  lead: LikerLead | null
}

export interface LikersSummary {
  people: number
  likes: number
  leads: number
  publications: number
  rows: LikerRow[]
}

/** Pure: one row per Instagram account, most likes first (then most recently seen). */
export function aggregateLikers(observations: LikeObservation[]): LikerRow[] {
  const byUser = new Map<string, LikerRow & { contents: Set<string> }>()
  for (const o of observations) {
    let row = byUser.get(o.instagram_user_id)
    if (!row) {
      row = { instagramUserId: o.instagram_user_id, username: o.instagram_username, fullName: o.full_name, profilePicUrl: o.profile_pic_url, likes: 0, lastSeenAt: o.first_observed_at, leadId: null, lead: null, contents: new Set() }
      byUser.set(o.instagram_user_id, row)
    }
    row.contents.add(o.content_id)
    // Latest observation wins for the display fields (renamed accounts, new pictures).
    if (o.first_observed_at >= row.lastSeenAt) {
      row.lastSeenAt = o.first_observed_at
      row.username = o.instagram_username
      row.fullName = o.full_name ?? row.fullName
      row.profilePicUrl = o.profile_pic_url ?? row.profilePicUrl
    }
    if (o.matched_lead_id) row.leadId = o.matched_lead_id
  }
  return [...byUser.values()]
    .map(({ contents, ...r }) => ({ ...r, likes: contents.size }))
    .sort((a, b) => b.likes - a.likes || b.lastSeenAt.localeCompare(a.lastSeenAt))
}

const PAGE = 1000
const COLS = 'instagram_user_id, instagram_username, full_name, profile_pic_url, content_id, first_observed_at, matched_lead_id'

async function loadObservations(supabase: SupabaseClient, workspaceId: string): Promise<LikeObservation[]> {
  const base = () => supabase.from('instagram_engagement_observations').select(COLS, { count: 'exact' }).eq('workspace_id', workspaceId).eq('interaction_type', 'like').order('id')
  const first = await base().range(0, PAGE - 1)
  if (first.error) throw new Error(first.error.message)
  const total = first.count ?? 0
  // PostgREST caps a response at 1000 rows: the other pages in parallel.
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(total / PAGE) - 1) }, (_, i) => base().range((i + 1) * PAGE, (i + 2) * PAGE - 1)),
  )
  const out = [...((first.data ?? []) as LikeObservation[])]
  for (const r of rest) {
    if (r.error) throw new Error(r.error.message)
    out.push(...((r.data ?? []) as LikeObservation[]))
  }
  return out
}

/** Leads behind the likers: the lead matched when the like was read, else by Instagram id, else by handle (lead created since). */
async function attachLeads(supabase: SupabaseClient, workspaceId: string, rows: LikerRow[]): Promise<void> {
  const LEAD_COLS = 'id, first_name, last_name, status, instagram_profile_pic_url, instagram_user_id, instagram_handle'
  const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 200) }, (_, i) => xs.slice(i * 200, i * 200 + 200))
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter((x): x is string => !!x))]
  const unmatched = rows.filter((r) => !r.leadId)
  const queries = [
    ...chunks(leadIds).map((ids) => supabase.from('leads').select(LEAD_COLS).eq('workspace_id', workspaceId).in('id', ids)),
    ...chunks(unmatched.map((r) => r.instagramUserId)).map((ids) => supabase.from('leads').select(LEAD_COLS).eq('workspace_id', workspaceId).in('instagram_user_id', ids)),
    ...chunks(unmatched.map((r) => r.username.toLowerCase())).map((hs) => supabase.from('leads').select(LEAD_COLS).eq('workspace_id', workspaceId).in('instagram_handle', hs)),
  ]
  const byId = new Map<string, LikerLead>()
  const byUid = new Map<string, LikerLead>()
  const byHandle = new Map<string, LikerLead>()
  for (const { data } of await Promise.all(queries)) {
    for (const l of (data ?? []) as (LikerLead & { instagram_user_id: string | null; instagram_handle: string | null })[]) {
      const lead: LikerLead = { id: l.id, first_name: l.first_name, last_name: l.last_name, status: l.status, instagram_profile_pic_url: l.instagram_profile_pic_url }
      byId.set(l.id, lead)
      if (l.instagram_user_id) byUid.set(l.instagram_user_id, lead)
      if (l.instagram_handle) byHandle.set(l.instagram_handle.toLowerCase(), lead)
    }
  }
  for (const r of rows) {
    r.lead = (r.leadId && byId.get(r.leadId)) || byUid.get(r.instagramUserId) || byHandle.get(r.username.toLowerCase()) || null
    r.leadId = r.lead?.id ?? null
  }
}

// Short per-process cache: switching tabs back to Audience shouldn't re-read thousands of rows.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; summary: LikersSummary }>()

export async function loadLikers(supabase: SupabaseClient, workspaceId: string): Promise<LikersSummary> {
  const hit = cache.get(workspaceId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.summary
  const observations = await loadObservations(supabase, workspaceId)
  const rows = aggregateLikers(observations)
  await attachLeads(supabase, workspaceId, rows)
  const summary: LikersSummary = {
    people: rows.length,
    likes: rows.reduce((s, r) => s + r.likes, 0),
    leads: rows.filter((r) => r.lead).length,
    publications: new Set(observations.map((o) => o.content_id)).size,
    rows,
  }
  cache.set(workspaceId, { at: Date.now(), summary })
  return summary
}
