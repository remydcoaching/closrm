// HikerAPI client — POC only. Backend/local usage only.
// NEVER log HIKER_API_KEY. NEVER write it to any output file.

const BASE_URL = 'https://api.hikerapi.com'

export interface CallLog {
  endpoint: string
  method: string
  status: number
  duration_ms: number
  items: number
  pagination: boolean
  estimated_billed_requests: number
  timestamp: string
  error?: string
  retry_count?: number
}

export const callLogs: CallLog[] = []

// Endpoints documented by HikerAPI as costing 2 billed requests per call
// (stories, and the /gql/ follower/following chunk variants).
const DOUBLE_BILLED_PATTERNS = [
  '/user/stories',
  '/gql/user/followers/chunk',
  '/gql/user/following/chunk',
]

function billedRequestsFor(path: string): number {
  return DOUBLE_BILLED_PATTERNS.some((p) => path.includes(p)) ? 2 : 1
}

interface RequestOptions {
  itemsExtractor?: (json: unknown) => number
  paginated?: boolean
  maxRetries?: number
}

export class HikerClient {
  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('HIKER_API_KEY missing')
  }

  async get<T = unknown>(path: string, opts: RequestOptions = {}): Promise<{ json: T; status: number }> {
    const url = `${BASE_URL}${path}`
    const maxRetries = opts.maxRetries ?? 2
    let attempt = 0
    let lastError: string | undefined

    while (attempt <= maxRetries) {
      const startedAt = Date.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-access-key': this.apiKey,
          },
        })
        const durationMs = Date.now() - startedAt
        const status = res.status

        // Retry only on transient errors (429, 5xx). Not on 4xx client errors.
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          attempt += 1
          lastError = `HTTP ${status}, retrying (attempt ${attempt})`
          await new Promise((r) => setTimeout(r, 500 * attempt))
          continue
        }

        const text = await res.text()
        let json: unknown = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = { raw: text.slice(0, 500) }
        }

        const items = opts.itemsExtractor ? opts.itemsExtractor(json) : Array.isArray(json) ? json.length : 1

        callLogs.push({
          endpoint: path.split('?')[0],
          method: 'GET',
          status,
          duration_ms: durationMs,
          items: status === 200 ? items : 0,
          pagination: opts.paginated ?? false,
          estimated_billed_requests: status === 200 ? billedRequestsFor(path) : 0,
          timestamp: new Date().toISOString(),
          error: status !== 200 ? `HTTP ${status}` : undefined,
          retry_count: attempt,
        })

        return { json: json as T, status }
      } catch (err) {
        const durationMs = Date.now() - startedAt
        lastError = err instanceof Error ? err.message : String(err)
        if (attempt < maxRetries) {
          attempt += 1
          await new Promise((r) => setTimeout(r, 500 * attempt))
          continue
        }
        callLogs.push({
          endpoint: path.split('?')[0],
          method: 'GET',
          status: 0,
          duration_ms: durationMs,
          items: 0,
          pagination: opts.paginated ?? false,
          estimated_billed_requests: 0,
          timestamp: new Date().toISOString(),
          error: lastError,
          retry_count: attempt,
        })
        return { json: null as T, status: 0 }
      }
    }
    throw new Error(`unreachable: ${lastError}`)
  }
}
