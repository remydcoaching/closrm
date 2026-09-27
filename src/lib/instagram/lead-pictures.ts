// Fills the Instagram profile (picture, id, counts) of leads that have a
// handle but no picture, through Hiker's /v1/user/by/username (paid: one
// billed request per lead). Launched by the coach, with a cap; each lead is
// saved as soon as its answer arrives, so a crash never loses paid results.
// Leads Instagram doesn't know (renamed / deleted) are marked synced so they
// are not paid for again.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HikerClient } from '@/lib/hiker/client'
import { HikerApiError } from '@/lib/hiker/errors'
import type { HikerUserProfile } from '@/lib/hiker/types'

export const MAX_PICTURES_PER_RUN = 300
const CONCURRENCY = 4
// A lead looked up recently (found or not) isn't paid for again before this.
const RETRY_AFTER_MS = 7 * 86_400_000

export interface LeadToEnrich {
  id: string
  instagram_handle: string | null
  instagram_user_id: string | null
  instagram_profile_pic_url: string | null
  instagram_profile_synced_at: string | null
}

const HANDLE = /^[a-z0-9._]{1,30}$/

export function normalizeHandle(raw: string | null): string | null {
  const h = (raw ?? '').trim().replace(/^@/, '').toLowerCase()
  return HANDLE.test(h) ? h : null
}

/** Pure: leads worth one paid lookup (valid handle, no picture, not looked up recently). */
export function leadsNeedingPicture(leads: LeadToEnrich[], now = Date.now()): LeadToEnrich[] {
  return leads.filter(
    (l) =>
      !l.instagram_profile_pic_url &&
      normalizeHandle(l.instagram_handle) !== null &&
      (!l.instagram_profile_synced_at || now - new Date(l.instagram_profile_synced_at).getTime() > RETRY_AFTER_MS),
  )
}

/** Pure: the lead update for a Hiker profile. The Instagram id is only set when the lead has none. */
export function profilePatch(lead: LeadToEnrich, p: HikerUserProfile, now: string): Record<string, unknown> {
  const id = p.pk ?? p.id
  return {
    instagram_profile_pic_url: p.profile_pic_url_hd ?? p.profile_pic_url ?? null,
    instagram_followers_count: p.follower_count ?? null,
    instagram_following_count: p.following_count ?? null,
    instagram_is_verified: p.is_verified ?? null,
    instagram_is_private: p.is_private ?? null,
    instagram_bio: p.biography ?? null,
    instagram_profile_synced_at: now,
    ...(!lead.instagram_user_id && id != null ? { instagram_user_id: String(id) } : {}),
  }
}

export async function countLeadsNeedingPicture(supabase: SupabaseClient, workspaceId: string): Promise<number> {
  return (await loadCandidates(supabase, workspaceId, 5000)).length
}

async function loadCandidates(supabase: SupabaseClient, workspaceId: string, max: number): Promise<LeadToEnrich[]> {
  const out: LeadToEnrich[] = []
  for (let from = 0; from < 20_000 && out.length < max; from += 1000) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, instagram_handle, instagram_user_id, instagram_profile_pic_url, instagram_profile_synced_at')
      .eq('workspace_id', workspaceId)
      .is('instagram_profile_pic_url', null)
      .not('instagram_handle', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...leadsNeedingPicture((data ?? []) as LeadToEnrich[]))
    if (!data || data.length < 1000) break
  }
  return out.slice(0, max)
}

export interface EnrichResult {
  requested: number
  updated: number
  notFound: number
  failed: number
  /** Hiker stopped the run (no credit, auth, rate limit): the rest is left for later. */
  stoppedBy: string | null
  errors: string[]
}

export async function enrichLeadPictures(supabase: SupabaseClient, workspaceId: string, client: HikerClient, limit: number): Promise<EnrichResult> {
  const leads = await loadCandidates(supabase, workspaceId, Math.min(Math.max(limit, 1), MAX_PICTURES_PER_RUN))
  const res: EnrichResult = { requested: 0, updated: 0, notFound: 0, failed: 0, stoppedBy: null, errors: [] }
  let next = 0
  const worker = async () => {
    while (next < leads.length && !res.stoppedBy) {
      const lead = leads[next++]
      const handle = normalizeHandle(lead.instagram_handle) as string
      const now = new Date().toISOString()
      res.requested += 1
      try {
        const profile = await client.getUserByUsername(handle)
        let patch = profilePatch(lead, profile, now)
        let { error } = await supabase.from('leads').update(patch).eq('workspace_id', workspaceId).eq('id', lead.id)
        // Another lead already carries this Instagram id (duplicate): keep the picture, skip the id.
        if (error && /leads_workspace_ig_user_id_uq|duplicate key/i.test(error.message) && 'instagram_user_id' in patch) {
          const { instagram_user_id: _dup, ...rest } = patch
          patch = rest
          ;({ error } = await supabase.from('leads').update(patch).eq('workspace_id', workspaceId).eq('id', lead.id))
        }
        if (error) {
          res.failed += 1
          res.errors.push(error.message)
        } else res.updated += 1
      } catch (err) {
        const category = err instanceof HikerApiError ? err.category : 'UNKNOWN'
        if (category === 'NOT_FOUND') {
          res.notFound += 1
          await supabase.from('leads').update({ instagram_profile_synced_at: now }).eq('workspace_id', workspaceId).eq('id', lead.id)
        } else if (category === 'INSUFFICIENT_FUNDS' || category === 'AUTH_ERROR' || category === 'RATE_LIMIT') {
          res.stoppedBy = category
        } else {
          res.failed += 1
          res.errors.push(`${handle}: ${category}`)
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  res.errors = res.errors.slice(0, 10)
  return res
}
