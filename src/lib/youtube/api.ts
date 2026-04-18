/**
 * Client HTTP YouTube Data API v3 + YouTube Analytics API v2.
 * Gestion du refresh token auto (mêmes credentials Google).
 */
import { getIntegrationCredentials } from '@/lib/integrations/get-credentials'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/crypto'

const DATA_API = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2'

// ─── Token management ──────────────────────────────────────────────────────

export async function getValidYoutubeAccessToken(workspaceId: string): Promise<string | null> {
  const creds = await getIntegrationCredentials(workspaceId, 'youtube')
  if (!creds) return null
  const { access_token, refresh_token, expires_at } = creds

  if (new Date(expires_at) > new Date(Date.now() + 60_000)) return access_token

  const clientId = process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
    }),
  })
  if (!res.ok) {
    console.error('[YouTube] Token refresh failed:', await res.text())
    return null
  }
  const data = await res.json()
  const supabase = createServiceClient()
  const newCreds = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
  await supabase
    .from('integrations')
    .update({ credentials_encrypted: encrypt(JSON.stringify(newCreds)) })
    .eq('workspace_id', workspaceId)
    .eq('type', 'youtube')
  return data.access_token
}

async function ytFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Data API v3 ────────────────────────────────────────────────────────────

export interface YtChannelInfo {
  id: string
  snippet: {
    title: string
    description?: string
    customUrl?: string
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } }
    country?: string
  }
  statistics: {
    viewCount: string
    subscriberCount: string
    videoCount: string
    hiddenSubscriberCount: boolean
  }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

export async function fetchMyChannel(token: string): Promise<YtChannelInfo | null> {
  const url = `${DATA_API}/channels?part=snippet,statistics,contentDetails&mine=true`
  const data = await ytFetch<{ items: YtChannelInfo[] }>(token, url)
  return data.items?.[0] ?? null
}

export interface YtPlaylistItem {
  contentDetails: { videoId: string; videoPublishedAt?: string }
}

/** Récupère TOUTES les vidéos d'une playlist (le uploadsPlaylistId pour avoir toutes les vidéos du channel). */
export async function fetchPlaylistVideoIds(
  token: string,
  playlistId: string,
  max = 200,
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  while (ids.length < max) {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = await ytFetch<{ items: YtPlaylistItem[]; nextPageToken?: string }>(
      token,
      `${DATA_API}/playlistItems?${params.toString()}`,
    )
    for (const it of data.items) ids.push(it.contentDetails.videoId)
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return ids.slice(0, max)
}

export interface YtVideoInfo {
  id: string
  snippet: {
    title?: string
    description?: string
    publishedAt?: string
    tags?: string[]
    categoryId?: string
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string }; maxres?: { url: string } }
  }
  contentDetails: { duration: string }       // ISO 8601 (PT1M30S)
  statistics: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
    favoriteCount?: string
  }
  status: { privacyStatus?: 'public' | 'unlisted' | 'private' }
}

/** videos.list accepte jusqu'à 50 IDs par requête. */
export async function fetchVideosByIds(token: string, ids: string[]): Promise<YtVideoInfo[]> {
  const results: YtVideoInfo[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics,status',
      id: batch.join(','),
      maxResults: '50',
    })
    const data = await ytFetch<{ items: YtVideoInfo[] }>(
      token,
      `${DATA_API}/videos?${params.toString()}`,
    )
    results.push(...data.items)
  }
  return results
}

// ─── Analytics API v2 ───────────────────────────────────────────────────────

export interface AnalyticsRow {
  [key: string]: string | number
}

export interface AnalyticsResponse {
  columnHeaders: { name: string; columnType: string; dataType: string }[]
  rows?: (string | number)[][]
}

/** Channel-level analytics entre 2 dates (ISO YYYY-MM-DD). */
export async function fetchChannelAnalytics(
  token: string,
  opts: { startDate: string; endDate: string; metrics?: string[]; dimensions?: string },
): Promise<AnalyticsResponse> {
  const metrics = opts.metrics ?? [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'averageViewPercentage',
    'subscribersGained',
    'subscribersLost',
    'likes',
    'comments',
    'shares',
  ]
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: opts.startDate,
    endDate: opts.endDate,
    metrics: metrics.join(','),
  })
  if (opts.dimensions) params.set('dimensions', opts.dimensions)
  return ytFetch<AnalyticsResponse>(token, `${ANALYTICS_API}/reports?${params.toString()}`)
}

export async function fetchVideoAnalytics(
  token: string,
  opts: { videoId: string; startDate: string; endDate: string; metrics?: string[]; dimensions?: string },
): Promise<AnalyticsResponse> {
  const metrics = opts.metrics ?? [
    'views',
    'estimatedMinutesWatched',
    'averageViewDuration',
    'averageViewPercentage',
    'likes',
    'comments',
    'shares',
    'subscribersGained',
    'subscribersLost',
  ]
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: opts.startDate,
    endDate: opts.endDate,
    metrics: metrics.join(','),
    filters: `video==${opts.videoId}`,
  })
  if (opts.dimensions) params.set('dimensions', opts.dimensions)
  return ytFetch<AnalyticsResponse>(token, `${ANALYTICS_API}/reports?${params.toString()}`)
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration (PT1M30S) → seconds. */
export function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return 0
  const h = parseInt(m[1] ?? '0', 10)
  const min = parseInt(m[2] ?? '0', 10)
  const s = parseInt(m[3] ?? '0', 10)
  return h * 3600 + min * 60 + s
}

/** YouTube Shorts accepte jusqu'à 3 min (180s) depuis fin 2024. Heuristique par durée seule. */
export function isShort(durationSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= 180
}
