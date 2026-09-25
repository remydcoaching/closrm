// Error taxonomy for the Hiker provider. Every failure surfaced by the client
// is classified into one of these categories so callers can decide whether to
// retry, stop the run, or treat a single content item as skipped without
// failing the whole discovery.
export type HikerErrorCategory =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'INSUFFICIENT_FUNDS'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'UNKNOWN'

export class HikerApiError extends Error {
  readonly category: HikerErrorCategory
  readonly status: number
  readonly endpoint: string

  constructor(category: HikerErrorCategory, status: number, endpoint: string, message?: string) {
    super(message ?? `Hiker API error: ${category} (HTTP ${status}) on ${endpoint}`)
    this.name = 'HikerApiError'
    this.category = category
    this.status = status
    this.endpoint = endpoint
  }
}

// Maps an HTTP status (and, for 402, the confirmed HikerAPI error body shape
// { state: false, error, exc_type: "InsufficientFunds" } observed during the
// POC) to a HikerErrorCategory. Never guesses a category from status alone
// when the body disambiguates it.
export function classifyHikerStatus(status: number, body: unknown): HikerErrorCategory {
  if (status === 401 || status === 403) return 'AUTH_ERROR'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 402) return 'INSUFFICIENT_FUNDS'
  if (status === 404) return 'NOT_FOUND'
  if (status >= 400 && status < 500) {
    const excType = (body as { exc_type?: string } | null)?.exc_type
    if (excType === 'InsufficientFunds') return 'INSUFFICIENT_FUNDS'
    return 'INVALID_REQUEST'
  }
  if (status >= 500) return 'SERVER_ERROR'
  return 'UNKNOWN'
}
