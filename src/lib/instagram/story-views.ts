// Story viewers of the coach's own account, pushed by ClosRM Desktop (which
// reads them from the coach's Instagram session while stories are live).
// Persists into story_view_stories / story_viewers (migration 112) and, for
// viewers who are already leads, a 'story_view' row in instagram_interactions
// so the view feeds the engagement score, the lead timeline and audience.
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

const viewerSchema = z.object({
  pk: z.string().min(1).max(40),
  username: z.string().min(1).max(60),
  fullName: z.string().max(200).nullish(),
  profilePicUrl: z.string().url().max(2000).nullish(),
  isVerified: z.boolean().nullish(),
  hasLiked: z.boolean().nullish(),
  isPrivate: z.boolean().nullish(),
  replyText: z.string().max(2000).nullish(),
})

const storySchema = z.object({
  pk: z.string().min(1).max(40),
  takenAt: z.string().datetime({ offset: true }),
  expiringAt: z.string().datetime({ offset: true }).nullish(),
  mediaType: z.enum(['image', 'video']).nullish(),
  thumbnailUrl: z.string().url().max(2000).nullish(),
  videoUrl: z.string().url().max(4000).nullish(),
  viewerCount: z.number().int().min(0).nullish(),
  likeCount: z.number().int().min(0).nullish(),
  highlightId: z.string().max(80).nullish(),
  highlightTitle: z.string().max(200).nullish(),
  /** 'error' = the viewer list could not be read: no viewer row is written or removed. */
  status: z.enum(['ok', 'error']).default('ok'),
  error: z.string().max(500).nullish(),
  viewers: z.array(viewerSchema).max(20000),
})

export const storyViewsPayloadSchema = z.object({
  accountUsername: z.string().min(1).max(60),
  stories: z.array(storySchema).max(100),
})

export type StoryViewsPayload = z.infer<typeof storyViewsPayloadSchema>

export interface LeadMatch {
  byUserId: Map<string, string>
  byHandle: Map<string, string>
}

export interface PlannedRows {
  stories: Record<string, unknown>[]
  viewers: Record<string, unknown>[]
  /** story_view interactions to insert (already-existing ones filtered out). */
  interactions: Record<string, unknown>[]
}

export function interactionKey(leadId: string, storyPk: string, userId: string): string {
  return `${leadId}|${storyPk}|${userId}`
}

/** Pure: turns a payload + lead matches into the rows to write. */
export function planStoryViewRows(
  workspaceId: string,
  payload: StoryViewsPayload,
  leads: LeadMatch,
  existingInteractions: Set<string>,
  now: string,
): PlannedRows {
  const stories: Record<string, unknown>[] = []
  const viewers: Record<string, unknown>[] = []
  const interactions: Record<string, unknown>[] = []

  for (const story of payload.stories) {
    const seen = new Set<string>()
    const readable = story.status !== 'error'
    for (const v of readable ? story.viewers : []) {
      if (seen.has(v.pk)) continue
      seen.add(v.pk)
      const leadId = leads.byUserId.get(v.pk) ?? leads.byHandle.get(v.username.toLowerCase()) ?? null
      viewers.push({
        workspace_id: workspaceId,
        story_pk: story.pk,
        instagram_user_id: v.pk,
        instagram_username: v.username,
        full_name: v.fullName ?? null,
        profile_pic_url: v.profilePicUrl ?? null,
        is_verified: v.isVerified ?? null,
        has_liked: v.hasLiked ?? null,
        is_private: v.isPrivate ?? null,
        matched_lead_id: leadId,
      })
      if (leadId && !existingInteractions.has(interactionKey(leadId, story.pk, v.pk))) {
        interactions.push({
          workspace_id: workspaceId,
          lead_id: leadId,
          interaction_type: 'story_view',
          instagram_user_id: v.pk,
          instagram_username: v.username,
          full_name: v.fullName ?? null,
          profile_url: `https://instagram.com/${v.username}`,
          source_post_id: story.pk,
          source_provider: 'desktop_session',
          // Observation times: Instagram doesn't say when the person viewed.
          first_seen_at: now,
          last_seen_at: now,
          metadata: {
            story_taken_at: story.takenAt,
            ...(story.highlightId ? { highlight_id: story.highlightId, highlight_title: story.highlightTitle ?? null } : {}),
          },
        })
      }
    }
    // Fields the client didn't send (a re-read of an expired story carries
    // no media; the live collector knows nothing about highlights) are left
    // out so the upsert keeps what was stored — never overwritten with null.
    const optional = (key: string, v: unknown) => (v === undefined ? {} : { [key]: v ?? null })
    stories.push({
      workspace_id: workspaceId,
      story_pk: story.pk,
      instagram_account_username: payload.accountUsername,
      taken_at: story.takenAt,
      ...optional('expiring_at', story.expiringAt),
      ...optional('media_type', story.mediaType),
      ...optional('thumbnail_url', story.thumbnailUrl),
      ...optional('viewer_count', story.viewerCount),
      viewers_collected: seen.size,
      last_collected_at: now,
      ...optional('highlight_id', story.highlightId),
      ...optional('highlight_title', story.highlightId === undefined ? undefined : story.highlightTitle),
      ...optional('like_count', story.likeCount),
      fetch_status: readable ? 'ok' : 'error',
      fetch_error: readable ? null : (story.error ?? 'Liste des spectateurs illisible'),
    })
  }
  return { stories, viewers, interactions }
}

export interface LeadIgState {
  userId: string | null
  picUrl: string | null
}

/** Pure: Instagram id / profile picture to write on matched leads (only what changes). */
export function planLeadEnrichment(
  payload: StoryViewsPayload,
  leads: LeadMatch,
  current: Map<string, LeadIgState>,
): { leadId: string; patch: Record<string, string> }[] {
  const out = new Map<string, Record<string, string>>()
  for (const story of payload.stories) {
    if (story.status === 'error') continue
    for (const v of story.viewers) {
      const leadId = leads.byUserId.get(v.pk) ?? leads.byHandle.get(v.username.toLowerCase())
      const state = leadId ? current.get(leadId) : undefined
      if (!leadId || !state || out.has(leadId)) continue
      const patch: Record<string, string> = {}
      if (!state.userId) patch.instagram_user_id = v.pk
      if (v.profilePicUrl && v.profilePicUrl !== state.picUrl) patch.instagram_profile_pic_url = v.profilePicUrl
      if (Object.keys(patch).length > 0) out.set(leadId, patch)
    }
  }
  return [...out].map(([leadId, patch]) => ({ leadId, patch }))
}

const CHUNK = 200
const WRITE_CHUNK = 500

export async function persistStoryViews(supabase: SupabaseClient, workspaceId: string, payload: StoryViewsPayload) {
  const errors: string[] = []
  const allViewers = payload.stories.flatMap((s) => s.viewers)
  const userIds = [...new Set(allViewers.map((v) => v.pk))]
  const handles = [...new Set(allViewers.map((v) => v.username.toLowerCase()))]

  const leads: LeadMatch = { byUserId: new Map(), byHandle: new Map() }
  const current = new Map<string, LeadIgState>()
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_user_id, instagram_profile_pic_url')
      .eq('workspace_id', workspaceId)
      .in('instagram_user_id', userIds.slice(i, i + CHUNK))
    for (const l of data ?? []) {
      if (!l.instagram_user_id) continue
      leads.byUserId.set(l.instagram_user_id, l.id)
      current.set(l.id, { userId: l.instagram_user_id, picUrl: l.instagram_profile_pic_url ?? null })
    }
  }
  for (let i = 0; i < handles.length; i += CHUNK) {
    const { data } = await supabase
      .from('leads')
      .select('id, instagram_handle, instagram_user_id, instagram_profile_pic_url')
      .eq('workspace_id', workspaceId)
      .in('instagram_handle', handles.slice(i, i + CHUNK))
    for (const l of data ?? []) {
      // A lead already tied to another Instagram id is someone else who
      // used this username before: the id wins, never the handle.
      if (!l.instagram_handle || l.instagram_user_id) continue
      leads.byHandle.set((l.instagram_handle as string).toLowerCase(), l.id)
      current.set(l.id, { userId: null, picUrl: l.instagram_profile_pic_url ?? null })
    }
  }

  const matchedLeadIds = [...new Set([...leads.byUserId.values(), ...leads.byHandle.values()])]
  const storyPks = payload.stories.map((s) => s.pk)
  const existing = new Set<string>()
  for (let i = 0; i < matchedLeadIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('instagram_interactions')
      .select('lead_id, source_post_id, instagram_user_id')
      .eq('workspace_id', workspaceId)
      .eq('interaction_type', 'story_view')
      .in('lead_id', matchedLeadIds.slice(i, i + CHUNK))
      .in('source_post_id', storyPks)
    for (const r of data ?? []) existing.add(interactionKey(r.lead_id, r.source_post_id, r.instagram_user_id))
  }

  const now = new Date().toISOString()
  const rows = planStoryViewRows(workspaceId, payload, leads, existing, now)

  if (rows.stories.length > 0) {
    // An 'error' story must not overwrite a previous successful count.
    const okStories = rows.stories.filter((r) => r.fetch_status === 'ok')
    const errStories = rows.stories
      .filter((r) => r.fetch_status === 'error')
      .map(({ viewers_collected: _v, ...r }) => r)
    // One upsert per set of columns: rows sent together must carry the same
    // keys, or PostgREST would write null into the ones a row lacks.
    const bySignature = new Map<string, Record<string, unknown>[]>()
    for (const r of [...okStories, ...errStories]) {
      const sig = Object.keys(r).sort().join(',')
      bySignature.set(sig, [...(bySignature.get(sig) ?? []), r])
    }
    for (const batch of bySignature.values()) {
      let rowsToWrite = batch
      let { error } = await supabase.from('story_view_stories').upsert(rowsToWrite, { onConflict: 'workspace_id,story_pk' })
      for (let attempt = 0; error && attempt < 6; attempt++) {
        const missing = ['highlight_id', 'highlight_title', 'like_count', 'fetch_status', 'fetch_error'].find((c) => error!.message.includes(c))
        if (!missing) break
        rowsToWrite = rowsToWrite.map(({ [missing]: _drop, ...rest }) => rest)
        ;({ error } = await supabase.from('story_view_stories').upsert(rowsToWrite, { onConflict: 'workspace_id,story_pk' }))
      }
      if (error) errors.push(`stories: ${error.message}`)
    }
  }
  for (let i = 0; i < rows.viewers.length; i += WRITE_CHUNK) {
    // Merge-upsert: first_seen_at is not sent, so the first sighting is kept.
    let chunk = rows.viewers.slice(i, i + WRITE_CHUNK)
    let { error } = await supabase.from('story_viewers').upsert(chunk, { onConflict: 'workspace_id,story_pk,instagram_user_id' })
    // Optional columns whose migration isn't applied yet: drop only the one
    // named in the error and retry (never lose has_liked because of is_private).
    for (let attempt = 0; error && attempt < 3; attempt++) {
      const missing = ['is_private', 'has_liked'].find((c) => error!.message.includes(c))
      if (!missing) break
      chunk = chunk.map(({ [missing]: _drop, ...rest }) => rest)
      ;({ error } = await supabase.from('story_viewers').upsert(chunk, { onConflict: 'workspace_id,story_pk,instagram_user_id' }))
    }
    if (error) errors.push(`viewers ${i}: ${error.message}`)
  }
  for (let i = 0; i < rows.interactions.length; i += WRITE_CHUNK) {
    const { error } = await supabase.from('instagram_interactions').insert(rows.interactions.slice(i, i + WRITE_CHUNK))
    if (error) errors.push(`interactions ${i}: ${error.message}`)
  }

  // Leads seen in a viewer list get their Instagram id (stable, unlike the
  // username) and a fresh profile picture.
  const updates = planLeadEnrichment(payload, leads, current)
  for (let i = 0; i < updates.length; i += 10) {
    const results = await Promise.all(
      updates.slice(i, i + 10).map(({ leadId, patch }) => supabase.from('leads').update(patch).eq('workspace_id', workspaceId).eq('id', leadId)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) errors.push(`leads: ${failed.error.message}`)
  }

  return {
    stories: rows.stories.length,
    storiesUnreadable: rows.stories.filter((r) => r.fetch_status === 'error').length,
    viewers: rows.viewers.length,
    leadsEnriched: updates.length,
    leadsMatched: new Set(rows.viewers.map((v) => v.matched_lead_id).filter(Boolean)).size,
    interactionsAdded: errors.some((e) => e.startsWith('interactions')) ? 0 : rows.interactions.length,
    errors,
  }
}
