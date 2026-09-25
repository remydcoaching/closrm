// Production Hiker API client. Server-side only — never import this from a
// client component or expose HIKER_API_KEY to the browser.
//
// Endpoints used are limited to the ones validated during the POC
// (scripts/hiker-poc/, see HIKER_POC_REPORT.md): /v1/user/by/username,
// /v1/user/medias/chunk, /v1/user/clips/chunk, /v3/media/likers,
// /v2/media/comments, /g2/user/followers, /v2/user/stories. The /gql/*
// variants are deliberately not used — the POC found them to return raw
// GraphQL incremental-delivery payloads (undocumented shape, unstable to
// parse), even though HikerAPI's own docs suggest them as replacements.
import { HikerApiError, classifyHikerStatus, type HikerErrorCategory } from './errors'
import type {
  HikerUserProfile,
  HikerChunkResponse,
  HikerMediaItem,
  HikerLikersResponse,
  HikerCommentsResponse,
  HikerComment,
  HikerPageIdResponse,
  HikerUserShort,
  HikerStoriesResponse,
  HikerStoryItem,
} from './types'

const DEFAULT_BASE_URL = 'https://api.hikerapi.com'
const DEFAULT_TIMEOUT_MS = 15_000

export interface HikerCallLogEntry {
  endpoint: string
  status: number
  duration_ms: number
  category: HikerErrorCategory | 'OK'
  retry_count: number
}

export interface HikerClientOptions {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
  maxRetries?: number
  onCall?: (entry: HikerCallLogEntry) => void
}

// Endpoints documented (POC-confirmed) to bill 2 requests per call.
const DOUBLE_BILLED_PATTERNS = ['/user/stories']

export function estimatedBilledRequests(path: string): number {
  return DOUBLE_BILLED_PATTERNS.some((p) => path.includes(p)) ? 2 : 1
}

export class HikerClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly onCall?: (entry: HikerCallLogEntry) => void

  constructor(options: HikerClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.HIKER_API_KEY
    if (!apiKey) {
      throw new Error(
        'HIKER_API_KEY is not set. It must be provided server-side only — never as NEXT_PUBLIC_HIKER_API_KEY.',
      )
    }
    this.apiKey = apiKey
    this.baseUrl = options.baseUrl ?? process.env.HIKER_API_BASE_URL ?? DEFAULT_BASE_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = options.maxRetries ?? 2
    this.onCall = options.onCall
  }

  // Fetches one page. Retries only on RATE_LIMIT/SERVER_ERROR with exponential
  // backoff; never retries INSUFFICIENT_FUNDS, NOT_FOUND, AUTH_ERROR or
  // INVALID_REQUEST — those are definitive for this call and the caller
  // decides what to do (skip the item, stop the run, etc.).
  private async request<T>(path: string): Promise<{ json: T | null; status: number; category: HikerErrorCategory | 'OK' }> {
    let attempt = 0
    while (true) {
      const startedAt = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers: { accept: 'application/json', 'x-access-key': this.apiKey },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        const durationMs = Date.now() - startedAt
        const text = await res.text()
        let json: unknown = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }

        if (res.status === 200) {
          this.onCall?.({ endpoint: path.split('?')[0], status: 200, duration_ms: durationMs, category: 'OK', retry_count: attempt })
          return { json: json as T, status: 200, category: 'OK' }
        }

        const category = classifyHikerStatus(res.status, json)
        this.onCall?.({ endpoint: path.split('?')[0], status: res.status, duration_ms: durationMs, category, retry_count: attempt })

        const retryable = (category === 'RATE_LIMIT' || category === 'SERVER_ERROR') && attempt < this.maxRetries
        if (retryable) {
          attempt += 1
          await sleep(500 * 2 ** (attempt - 1))
          continue
        }

        return { json: json as T, status: res.status, category }
      } catch (err) {
        clearTimeout(timeout)
        const durationMs = Date.now() - startedAt
        const isAbort = err instanceof Error && err.name === 'AbortError'
        const category: HikerErrorCategory = isAbort ? 'SERVER_ERROR' : 'UNKNOWN'
        this.onCall?.({ endpoint: path.split('?')[0], status: 0, duration_ms: durationMs, category, retry_count: attempt })
        if (attempt < this.maxRetries) {
          attempt += 1
          await sleep(500 * 2 ** (attempt - 1))
          continue
        }
        return { json: null, status: 0, category }
      }
    }
  }

  async getUserByUsername(username: string): Promise<HikerUserProfile> {
    const { json, status, category } = await this.request<HikerUserProfile>(
      `/v1/user/by/username?username=${encodeURIComponent(username)}`,
    )
    if (status !== 200 || !json) {
      throw new HikerApiError(category === 'OK' ? 'UNKNOWN' : category, status, '/v1/user/by/username')
    }
    return json
  }

  async getUserMediaChunkPage(userId: string, cursor: string | null): Promise<{ items: HikerMediaItem[]; nextCursor: string | null }> {
    const path = `/v1/user/medias/chunk?user_id=${userId}${cursor ? `&end_cursor=${cursor}` : ''}`
    const { json, status, category } = await this.request<HikerChunkResponse<HikerMediaItem>>(path)
    if (status !== 200 || !json) throw new HikerApiError(category === 'OK' ? 'UNKNOWN' : category, status, '/v1/user/medias/chunk')
    return { items: json[0] ?? [], nextCursor: json[1] ?? null }
  }

  async getUserClipsChunkPage(userId: string, cursor: string | null): Promise<{ items: HikerMediaItem[]; nextCursor: string | null }> {
    const path = `/v1/user/clips/chunk?user_id=${userId}${cursor ? `&end_cursor=${cursor}` : ''}`
    const { json, status, category } = await this.request<HikerChunkResponse<HikerMediaItem>>(path)
    if (status !== 200 || !json) throw new HikerApiError(category === 'OK' ? 'UNKNOWN' : category, status, '/v1/user/clips/chunk')
    return { items: json[0] ?? [], nextCursor: json[1] ?? null }
  }

  // Not paginated — HikerAPI returns a single capped page (POC-confirmed: no
  // pagination available beyond what this one call returns). Caller must
  // treat likers coverage as partial, never as complete.
  async getMediaLikers(mediaId: string): Promise<{ users: HikerUserShort[]; status: number; category: HikerErrorCategory | 'OK' }> {
    const { json, status, category } = await this.request<HikerLikersResponse>(`/v3/media/likers?id=${mediaId}`)
    if (status !== 200 || !json) return { users: [], status, category }
    return { users: json.users ?? [], status, category }
  }

  async getMediaCommentsPage(
    mediaId: string,
    pageId: string | null,
  ): Promise<{
    comments: HikerComment[]
    nextPageId: string | null
    status: number
    category: HikerErrorCategory | 'OK'
  }> {
    const path = `/v2/media/comments?id=${mediaId}${pageId ? `&page_id=${pageId}` : ''}`
    const { json, status, category } = await this.request<HikerCommentsResponse>(path)
    if (status !== 200 || !json) {
      // NOT_FOUND here is a per-media condition (disabled comments, deleted
      // media, or an unconfirmed Hiker-side restriction — see
      // HIKER_POC_REPORT.md §2). It must never be conflated with "zero
      // comments"; callers distinguish this from a real 200-with-empty-array.
      return { comments: [], nextPageId: null, status, category }
    }
    return { comments: json.response?.comments ?? [], nextPageId: json.next_page_id ?? null, status, category }
  }

  async getFollowersPage(userId: string, pageId: string | null): Promise<{ users: HikerUserShort[]; nextPageId: string | null }> {
    const path = `/g2/user/followers?user_id=${userId}${pageId ? `&page_id=${pageId}` : ''}`
    const { json, status, category } = await this.request<HikerPageIdResponse<'users', HikerUserShort>>(path)
    if (status !== 200 || !json) throw new HikerApiError(category === 'OK' ? 'UNKNOWN' : category, status, '/g2/user/followers')
    return { users: json.response?.users ?? [], nextPageId: json.next_page_id ?? null }
  }

  async getUserStories(userId: string): Promise<{ items: HikerStoryItem[] }> {
    const { json, status } = await this.request<HikerStoriesResponse>(`/v2/user/stories?user_id=${userId}`)
    if (status !== 200 || !json) return { items: [] }
    return { items: json.reel?.items ?? [] }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
