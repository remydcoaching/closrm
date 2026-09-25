import { HikerClient, callLogs } from './hiker-client'
import { Deduplicator, type NormalizedUser, type Interaction, type AggregatedProfile } from './normalize'

interface UserShortLike {
  pk?: number | string
  id?: number | string
  username: string
  full_name?: string | null
  profile_pic_url?: string | null
  profile_pic_url_hd?: string | null
  is_verified?: boolean | null
  is_private?: boolean | null
}

function toNormalizedUser(u: UserShortLike): NormalizedUser {
  const id = u.pk ?? u.id
  return {
    instagram_user_id: id != null ? String(id) : null,
    username: u.username,
    full_name: u.full_name ?? null,
    profile_pic_url: u.profile_pic_url ?? u.profile_pic_url_hd ?? null,
    is_verified: u.is_verified ?? null,
    is_private: u.is_private ?? null,
  }
}

export interface MediaItem {
  pk?: number | string
  id?: string
  code?: string
  taken_at?: number
  media_type?: number
  product_type?: string
  thumbnail_url?: string
  video_url?: string
  comment_count?: number
  like_count?: number
  play_count?: number
  view_count?: number
  caption_text?: string
}

export interface DiscoveryLimits {
  maxMediaPages: number
  maxClipsPages: number
  maxFollowerPages: number
  maxMediaForLikersAndComments: number // safety cap: how many media items get likers/comments fetched
}

export interface DiscoveryResult {
  profile: unknown
  targetInstaId: string
  targetUsername: string
  media: MediaItem[]
  clips: MediaItem[]
  followers: NormalizedUser[]
  stories: unknown[]
  mediaEndpointUsed: string
  clipsEndpointUsed: string
  followersEndpointUsed: string
  likersCoverage: Array<{
    media_id: string
    media_code: string | null
    like_count_reported: number | null
    likers_returned: number
    coverage_pct: number | null
    pagination_available: boolean
  }>
  commentsResults: Array<{
    media_id: string
    media_code: string | null
    comment_count_reported: number | null
    comments_returned: number
    pages_fetched: number
  }>
  errors: Array<{ context: string; message: string }>
  dedup: Deduplicator
  interactionsCount: number
}

// Generic paginator for the "chunk" style: response = [items[], next_cursor|null]
async function paginateChunk<T>(
  client: HikerClient,
  buildPath: (cursor: string | null) => string,
  opts: { maxPages: number; itemsExtractor?: (json: unknown) => number },
): Promise<{ items: T[]; pages: number; endpoint: string }> {
  const allItems: T[] = []
  let cursor: string | null = null
  let pages = 0
  let endpoint = ''

  while (pages < opts.maxPages) {
    const path = buildPath(cursor)
    endpoint = path.split('?')[0]
    const { json, status } = await client.get<[T[], string | null]>(path, {
      paginated: true,
      itemsExtractor: (j) => (Array.isArray(j) && Array.isArray(j[0]) ? j[0].length : 0),
    })
    pages += 1
    if (status !== 200 || !json || !Array.isArray(json)) break
    const [items, nextCursor] = json
    if (Array.isArray(items)) allItems.push(...items)
    if (!nextCursor) break
    cursor = nextCursor
  }
  return { items: allItems, pages, endpoint }
}

// Generic paginator for the "page_id" style confirmed via probing on /g2/user/followers:
// response = { response: { <itemsKey>: [...] }, next_page_id }
async function paginatePageId<T>(
  client: HikerClient,
  buildPath: (pageId: string | null) => string,
  itemsKey: string,
  opts: { maxPages: number },
): Promise<{ items: T[]; pages: number; endpoint: string }> {
  const allItems: T[] = []
  let pageId: string | null = null
  let pages = 0
  let endpoint = ''

  while (pages < opts.maxPages) {
    const path = buildPath(pageId)
    endpoint = path.split('?')[0]
    const { json, status } = await client.get<{ response?: Record<string, unknown>; next_page_id?: string | null }>(
      path,
      {
        paginated: true,
        itemsExtractor: (j) => {
          const obj = j as { response?: Record<string, unknown> } | null
          const arr = obj?.response?.[itemsKey]
          return Array.isArray(arr) ? arr.length : 0
        },
      },
    )
    pages += 1
    if (status !== 200 || !json) break
    const items = json.response?.[itemsKey]
    if (Array.isArray(items)) allItems.push(...(items as T[]))
    const next = json.next_page_id
    if (!next || typeof next !== 'string') break
    pageId = next
  }
  return { items: allItems, pages, endpoint }
}

export async function runDiscovery(
  client: HikerClient,
  username: string,
  limits: DiscoveryLimits,
): Promise<DiscoveryResult> {
  const errors: DiscoveryResult['errors'] = []

  // 1. Resolve username -> profile
  const { json: profile, status: profileStatus } = await client.get(`/v1/user/by/username?username=${username}`)
  if (profileStatus !== 200 || !profile) {
    throw new Error(`Failed to resolve username ${username}: HTTP ${profileStatus}`)
  }
  const targetInstaId = String((profile as Record<string, unknown>).pk)
  const targetUsername = (profile as Record<string, unknown>).username as string

  // 2. Media — /v1/user/medias/chunk confirmed working with documented [items[], cursor] shape
  // during endpoint probing (see probe-endpoints.ts run). /gql/user/medias returns raw
  // Relay/GraphQL incremental-delivery stream_rows (undocumented by HikerAPI, unstable to
  // parse) — not used here even though the docs suggest it as the "recommended" replacement.
  const mediaResult = await paginateChunk<MediaItem>(
    client,
    (cursor) => `/v1/user/medias/chunk?user_id=${targetInstaId}${cursor ? `&end_cursor=${cursor}` : ''}`,
    { maxPages: limits.maxMediaPages },
  )

  // 3. Clips (Reels) — same reasoning as media above.
  const clipsResult = await paginateChunk<MediaItem>(
    client,
    (cursor) => `/v1/user/clips/chunk?user_id=${targetInstaId}${cursor ? `&end_cursor=${cursor}` : ''}`,
    { maxPages: limits.maxClipsPages },
  )

  // 4. Followers — /g2/user/followers (recommended over legacy /v1)
  let followersResult: { items: UserShortLike[]; pages: number; endpoint: string }
  try {
    followersResult = await paginatePageId<UserShortLike>(
      client,
      (pageId) => `/g2/user/followers?user_id=${targetInstaId}${pageId ? `&page_id=${pageId}` : ''}`,
      'users',
      { maxPages: limits.maxFollowerPages },
    )
  } catch (e) {
    errors.push({ context: 'followers:g2', message: e instanceof Error ? e.message : String(e) })
    followersResult = { items: [], pages: 0, endpoint: '/g2/user/followers' }
  }

  // 5. Stories (active only, if any) — response shape confirmed via probing:
  // { broadcast, reel: { items: [...] } | null, unviewable_authors_info, status }, not a bare array.
  const { json: storiesJson, status: storiesStatus } = await client.get<{
    reel?: { items?: unknown[] } | null
  }>(`/v2/user/stories?user_id=${targetInstaId}`, {
    itemsExtractor: (j) => (j as { reel?: { items?: unknown[] } })?.reel?.items?.length ?? 0,
  })
  const stories =
    storiesStatus === 200 && Array.isArray(storiesJson?.reel?.items) ? storiesJson.reel!.items! : []

  // 6. Likers + comments per content (deduplicate media+clips by media id first)
  const allContent = [...mediaResult.items, ...clipsResult.items]
  const seenMediaIds = new Set<string>()
  const uniqueContent = allContent.filter((m) => {
    const id = String(m.pk ?? m.id ?? '')
    if (!id || seenMediaIds.has(id)) return false
    seenMediaIds.add(id)
    return true
  })
  const contentToAnalyze = uniqueContent.slice(0, limits.maxMediaForLikersAndComments)

  const likersCoverage: DiscoveryResult['likersCoverage'] = []
  const commentsResults: DiscoveryResult['commentsResults'] = []
  const interactions: Array<{ user: NormalizedUser; interaction: Omit<Interaction, 'instagram_user_id' | 'username'> }> = []

  for (const media of contentToAnalyze) {
    const mediaId = String(media.pk ?? media.id ?? '')
    if (!mediaId) continue

    // Likers — /v3/media/likers returns { users: [...], user_count, ... }, not a bare array
    // (confirmed via probe against a real media id; documented endpoint list did not specify
    // the exact response shape).
    const { json: likersJson, status: likersStatus } = await client.get<{ users?: UserShortLike[]; user_count?: number }>(
      `/v3/media/likers?id=${mediaId}`,
      { itemsExtractor: (j) => (j as { users?: unknown[] })?.users?.length ?? 0 },
    )
    const likers = likersStatus === 200 && Array.isArray(likersJson?.users) ? likersJson.users : []
    const likeCountReported = media.like_count ?? null
    likersCoverage.push({
      media_id: mediaId,
      media_code: media.code ?? null,
      like_count_reported: likeCountReported,
      likers_returned: likers.length,
      coverage_pct: likeCountReported && likeCountReported > 0 ? Math.round((likers.length / likeCountReported) * 1000) / 10 : null,
      pagination_available: false, // documented: no pagination on this endpoint
    })
    for (const liker of likers) {
      interactions.push({
        user: toNormalizedUser(liker),
        interaction: {
          interaction_type: 'like',
          source_media_id: mediaId,
          source_media_code: media.code ?? null,
          observed_at: new Date().toISOString(),
          provider: 'hiker',
        },
      })
    }

    // Comments (paginated via page_id style)
    let commentPages = 0
    let commentTotal = 0
    let pageId: string | null = null
    const maxCommentPages = 10 // safety cap, documented per-page size ~15-30 items
    while (commentPages < maxCommentPages) {
      const commentsPath: string = `/v2/media/comments?id=${mediaId}${pageId ? `&page_id=${pageId}` : ''}`
      const commentsCall: { json: Record<string, unknown> | null; status: number } = await client.get<
        Record<string, unknown>
      >(commentsPath, { paginated: true })
      const json = commentsCall.json
      const status: number = commentsCall.status
      commentPages += 1
      if (status !== 200 || !json) break
      const responseObj = json.response as
        | { comments?: Array<{ pk?: string; user?: UserShortLike; text?: string; created_at?: number }> }
        | undefined
      const comments = responseObj?.comments
      if (Array.isArray(comments)) {
        commentTotal += comments.length
        for (const c of comments) {
          if (c.user) {
            interactions.push({
              user: toNormalizedUser(c.user),
              interaction: {
                interaction_type: 'comment',
                source_media_id: mediaId,
                source_media_code: media.code ?? null,
                observed_at: c.created_at ? new Date(c.created_at * 1000).toISOString() : new Date().toISOString(),
                provider: 'hiker',
              },
            })
          }
        }
      }
      const nextPageId: unknown = json.next_page_id
      if (!nextPageId || typeof nextPageId !== 'string') break
      pageId = nextPageId
    }
    commentsResults.push({
      media_id: mediaId,
      media_code: media.code ?? null,
      comment_count_reported: media.comment_count ?? null,
      comments_returned: commentTotal,
      pages_fetched: commentPages,
    })
  }

  // 7. Feed followers into interactions too
  for (const f of followersResult.items) {
    interactions.push({
      user: toNormalizedUser(f),
      interaction: {
        interaction_type: 'follower',
        source_media_id: null,
        source_media_code: null,
        observed_at: new Date().toISOString(),
        provider: 'hiker',
      },
    })
  }

  // 8. Deduplicate + aggregate
  const dedup = new Deduplicator()
  for (const { user, interaction } of interactions) {
    dedup.recordInteraction(user, interaction)
  }

  return {
    profile,
    targetInstaId,
    targetUsername,
    media: mediaResult.items,
    clips: clipsResult.items,
    followers: followersResult.items.map(toNormalizedUser),
    stories,
    mediaEndpointUsed: mediaResult.endpoint,
    clipsEndpointUsed: clipsResult.endpoint,
    followersEndpointUsed: followersResult.endpoint,
    likersCoverage,
    commentsResults,
    errors,
    dedup,
    interactionsCount: interactions.length,
  }
}

export { callLogs }
