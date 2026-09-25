// Hiker discovery engine — orchestrates the Hiker client, normalizer and
// deduplicator into a single structured discovery result. Pure computation +
// I/O to Hiker only; does NOT write to ClosRM's database (see
// src/lib/hiker/persist.ts for that boundary).
import { HikerClient, type HikerCallLogEntry, estimatedBilledRequests } from './client'
import { HikerApiError } from './errors'
import { normalizeUser, normalizeContent, dedupeContents, type NormalizedContent, type NormalizedUser } from './normalizer'
import { UserDeduplicator, type DiscoveredProfile } from './deduplicator'
import type { HikerUserProfile, HikerMediaItem, HikerStoryItem } from './types'

export interface DiscoveryOptions {
  maxMediaPages?: number
  maxClipsPages?: number
  maxFollowerPages?: number
  maxContentsForInteractions?: number
  onLog?: (message: string) => void
}

const DEFAULTS: Required<Omit<DiscoveryOptions, 'onLog'>> = {
  maxMediaPages: 200, // no artificial content cap — bounded only to prevent runaway pagination bugs
  maxClipsPages: 200,
  maxFollowerPages: 500,
  maxContentsForInteractions: 200,
}

export interface DiscoveredInteraction {
  instagramUserId: string | null
  username: string
  fullName: string | null
  profileUrl: string
  interactionType: 'like' | 'comment'
  sourceContentId: string
  sourceContentUrl: string | null
  observedAt: string
}

export interface ContentErrorEntry {
  contentId: string
  stage: 'likers' | 'comments'
  status: 'not_found' | 'error'
  httpStatus: number
}

export interface DiscoveryResult {
  account: { instagramUserId: string; username: string; profile: HikerUserProfile }
  contents: NormalizedContent[]
  users: NormalizedProfile[]
  interactions: DiscoveredInteraction[]
  followers: NormalizedUser[]
  stories: HikerStoryItem[]
  stats: {
    mediaFetched: number
    clipsFetched: number
    uniqueContentsFetched: number
    contentsAnalyzedForInteractions: number
    uniqueUsers: number
    totalInteractions: number
    followersFetched: number
    httpCalls: number
    estimatedBilledRequests: number
    startedAt: string
    completedAt: string
    durationMs: number
  }
  errors: ContentErrorEntry[]
  warnings: string[]
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  stoppedReason: 'completed' | 'insufficient_funds' | 'auth_error' | null
}

export interface NormalizedProfile extends DiscoveredProfile {
  sources: Array<'liker' | 'commenter' | 'follower'>
}

// Factory rather than a bare HikerClient parameter: this discovery run needs
// its own call-count/billing accounting, and HikerClient's onCall is set once
// at construction. Callers build the client via this factory so the counters
// below are wired in before the first request.
export async function discoverInstagramAccount(
  buildClient: (onCall: (entry: HikerCallLogEntry) => void) => HikerClient,
  instagramUsername: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const opts = { ...DEFAULTS, ...options }
  const startedAt = new Date().toISOString()
  const startedAtMs = Date.now()
  const warnings: string[] = []
  const errors: ContentErrorEntry[] = []
  let httpCalls = 0
  let billed = 0
  const runClient = buildClient((entry) => {
    httpCalls += 1
    if (entry.category === 'OK') billed += estimatedBilledRequests(entry.endpoint)
    options.onLog?.(`[HIKER] ${entry.endpoint} -> ${entry.status} (${entry.duration_ms}ms)`)
  })

  options.onLog?.(`[HIKER] discovery started for @${instagramUsername}`)

  let profile: HikerUserProfile
  try {
    profile = await runClient.getUserByUsername(instagramUsername)
  } catch (err) {
    if (err instanceof HikerApiError && err.category === 'INSUFFICIENT_FUNDS') {
      return emptyResult(startedAt, startedAtMs, httpCalls, billed, 'FAILED', 'insufficient_funds', [
        'Could not resolve username: Hiker account has insufficient funds.',
      ])
    }
    throw err
  }
  const targetInstaId = String(profile.pk ?? profile.id)
  options.onLog?.(`[HIKER] resolved @${instagramUsername} -> ${targetInstaId}`)

  let stoppedReason: DiscoveryResult['stoppedReason'] = null

  // Media
  const mediaItems: HikerMediaItem[] = []
  {
    let cursor: string | null = null
    let pages = 0
    while (pages < opts.maxMediaPages) {
      try {
        const page = await runClient.getUserMediaChunkPage(targetInstaId, cursor)
        mediaItems.push(...page.items)
        pages += 1
        options.onLog?.(`[HIKER] medias page ${pages}`)
        if (!page.nextCursor) break
        cursor = page.nextCursor
      } catch (err) {
        if (err instanceof HikerApiError && err.category === 'INSUFFICIENT_FUNDS') {
          stoppedReason = 'insufficient_funds'
          warnings.push('Media pagination stopped early: insufficient funds.')
        }
        break
      }
    }
  }

  // Clips
  const clipItems: HikerMediaItem[] = []
  if (!stoppedReason) {
    let cursor: string | null = null
    let pages = 0
    while (pages < opts.maxClipsPages) {
      try {
        const page = await runClient.getUserClipsChunkPage(targetInstaId, cursor)
        clipItems.push(...page.items)
        pages += 1
        options.onLog?.(`[HIKER] clips page ${pages}`)
        if (!page.nextCursor) break
        cursor = page.nextCursor
      } catch (err) {
        if (err instanceof HikerApiError && err.category === 'INSUFFICIENT_FUNDS') {
          stoppedReason = 'insufficient_funds'
          warnings.push('Clips pagination stopped early: insufficient funds.')
        }
        break
      }
    }
  }

  const normalizedMedia = mediaItems.map((m) => normalizeContent(m, 'media', instagramUsername)).filter((c): c is NormalizedContent => c !== null)
  const normalizedClips = clipItems.map((c) => normalizeContent(c, 'clip', instagramUsername)).filter((c): c is NormalizedContent => c !== null)
  // Media and clips are NOT assumed disjoint (POC finding — see
  // HIKER_POC_REPORT.md §1: never confirmed whether the 60 media + 98 clips
  // observed overlapped). Deduplicate explicitly by content id/shortcode.
  const allContents = dedupeContents([...normalizedMedia, ...normalizedClips])

  // Followers
  const followerUsers: NormalizedUser[] = []
  if (!stoppedReason) {
    let pageId: string | null = null
    let pages = 0
    while (pages < opts.maxFollowerPages) {
      try {
        const page = await runClient.getFollowersPage(targetInstaId, pageId)
        followerUsers.push(...page.users.map(normalizeUser))
        pages += 1
        options.onLog?.(`[HIKER] followers page ${pages}`)
        if (!page.nextPageId) break
        pageId = page.nextPageId
      } catch (err) {
        if (err instanceof HikerApiError && err.category === 'INSUFFICIENT_FUNDS') {
          stoppedReason = 'insufficient_funds'
          warnings.push('Followers pagination stopped early: insufficient funds.')
        }
        break
      }
    }
  }

  // Stories (active only)
  let stories: HikerStoryItem[] = []
  if (!stoppedReason) {
    try {
      const res = await runClient.getUserStories(targetInstaId)
      stories = res.items
      options.onLog?.(`[HIKER] stories: ${stories.length} active`)
    } catch {
      warnings.push('Could not fetch active stories (non-fatal).')
    }
  }

  // Likers + comments per content, up to maxContentsForInteractions
  const dedup = new UserDeduplicator()
  const interactions: DiscoveredInteraction[] = []
  const contentsToAnalyze = allContents.slice(0, opts.maxContentsForInteractions)

  if (allContents.length > opts.maxContentsForInteractions) {
    warnings.push(
      `Only analyzed likers/comments for ${opts.maxContentsForInteractions} of ${allContents.length} contents (maxContentsForInteractions option).`,
    )
  }

  for (const content of contentsToAnalyze) {
    if (stoppedReason) break

    options.onLog?.(`[HIKER] likers content=${content.id}`)
    const likersResult = await runClient.getMediaLikers(content.id)
    if (likersResult.category === 'INSUFFICIENT_FUNDS') {
      stoppedReason = 'insufficient_funds'
      warnings.push('Likers fetch stopped early: insufficient funds.')
      break
    }
    if (likersResult.category !== 'OK' && likersResult.status !== 200) {
      errors.push({ contentId: content.id, stage: 'likers', status: likersResult.category === 'NOT_FOUND' ? 'not_found' : 'error', httpStatus: likersResult.status })
    } else {
      // Likers coverage is never guaranteed complete — HikerAPI caps this
      // endpoint with no real pagination beyond what one call returns (POC
      // finding, HIKER_POC_REPORT.md §9). This is recorded as a warning, not
      // silently presented as exhaustive.
      for (const liker of likersResult.users) {
        const nu = normalizeUser(liker)
        dedup.recordInteraction(nu, 'like', content.id, new Date().toISOString())
        interactions.push({
          instagramUserId: nu.instagramUserId,
          username: nu.username,
          fullName: nu.fullName,
          profileUrl: `https://www.instagram.com/${nu.username}/`,
          interactionType: 'like',
          sourceContentId: content.id,
          sourceContentUrl: content.url,
          observedAt: new Date().toISOString(),
        })
      }
    }

    options.onLog?.(`[HIKER] comments content=${content.id}`)
    let pageId: string | null = null
    let commentPages = 0
    const maxCommentPages = 10
    while (commentPages < maxCommentPages) {
      const commentsResult = await runClient.getMediaCommentsPage(content.id, pageId)
      commentPages += 1
      if (commentsResult.category === 'INSUFFICIENT_FUNDS') {
        stoppedReason = 'insufficient_funds'
        warnings.push('Comments fetch stopped early: insufficient funds.')
        break
      }
      if (commentsResult.status !== 200) {
        // A 404 here means "could not fetch comments for this content" — it
        // is explicitly NOT treated as "zero comments". See
        // HIKER_POC_REPORT.md §2 for the ambiguity this addresses.
        errors.push({
          contentId: content.id,
          stage: 'comments',
          status: commentsResult.category === 'NOT_FOUND' ? 'not_found' : 'error',
          httpStatus: commentsResult.status,
        })
        break
      }
      for (const c of commentsResult.comments) {
        if (!c.user) continue
        const nu = normalizeUser(c.user)
        // c.created_at is documented as a unix timestamp, but has been
        // observed non-numeric/absent for some comment shapes — a truthy
        // check alone let `new Date(NaN)` through, which only throws at
        // .toISOString() (RangeError: Invalid time value), crashing the
        // whole discovery run after real, billed Hiker requests had already
        // run. Validate the parsed date explicitly instead.
        const parsedCreatedAt = typeof c.created_at === 'number' ? new Date(c.created_at * 1000) : null
        const observedAt = parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime()) ? parsedCreatedAt.toISOString() : new Date().toISOString()
        dedup.recordInteraction(nu, 'comment', content.id, observedAt)
        interactions.push({
          instagramUserId: nu.instagramUserId,
          username: nu.username,
          fullName: nu.fullName,
          profileUrl: `https://www.instagram.com/${nu.username}/`,
          interactionType: 'comment',
          sourceContentId: content.id,
          sourceContentUrl: content.url,
          observedAt,
        })
      }
      if (!commentsResult.nextPageId) break
      pageId = commentsResult.nextPageId
    }
    if (stoppedReason) break
  }

  // Followers are recorded on profiles for enrichment (follows_target) but
  // are never turned into instagram_interactions rows — a follow is not an
  // engagement event per the current schema (interaction_type CHECK is
  // like/comment/dm/mention only).
  for (const f of followerUsers) dedup.markFollower(f)

  const users: NormalizedProfile[] = dedup.allProfiles().map((p) => ({
    ...p,
    sources: [
      ...(p.likeCount > 0 ? (['liker'] as const) : []),
      ...(p.commentCount > 0 ? (['commenter'] as const) : []),
      ...(p.followsTarget ? (['follower'] as const) : []),
    ],
  }))

  const completedAt = new Date().toISOString()
  const durationMs = Date.now() - startedAtMs

  const status: DiscoveryResult['status'] = stoppedReason
    ? errors.length + interactions.length > 0
      ? 'PARTIAL'
      : 'FAILED'
    : 'SUCCESS'

  return {
    account: { instagramUserId: targetInstaId, username: profile.username, profile },
    contents: allContents,
    users,
    interactions,
    followers: followerUsers,
    stories,
    stats: {
      mediaFetched: normalizedMedia.length,
      clipsFetched: normalizedClips.length,
      uniqueContentsFetched: allContents.length,
      contentsAnalyzedForInteractions: contentsToAnalyze.length,
      uniqueUsers: users.length,
      totalInteractions: interactions.length,
      followersFetched: followerUsers.length,
      httpCalls,
      estimatedBilledRequests: billed,
      startedAt,
      completedAt,
      durationMs,
    },
    errors,
    warnings,
    status,
    stoppedReason,
  }
}

function emptyResult(
  startedAt: string,
  startedAtMs: number,
  httpCalls: number,
  billed: number,
  status: DiscoveryResult['status'],
  stoppedReason: DiscoveryResult['stoppedReason'],
  warnings: string[],
): DiscoveryResult {
  const completedAt = new Date().toISOString()
  return {
    account: { instagramUserId: '', username: '', profile: {} as HikerUserProfile },
    contents: [],
    users: [],
    interactions: [],
    followers: [],
    stories: [],
    stats: {
      mediaFetched: 0,
      clipsFetched: 0,
      uniqueContentsFetched: 0,
      contentsAnalyzedForInteractions: 0,
      uniqueUsers: 0,
      totalInteractions: 0,
      followersFetched: 0,
      httpCalls,
      estimatedBilledRequests: billed,
      startedAt,
      completedAt,
      durationMs: Date.now() - startedAtMs,
    },
    errors: [],
    warnings,
    status,
    stoppedReason,
  }
}
