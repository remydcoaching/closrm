// A Meta token that no longer works (error code 190: expired, revoked, or
// invalidated after a Facebook password change). Detected so the coach is
// asked to reconnect instead of ClosRM silently failing for months.

export class MetaTokenInvalidError extends Error {
  constructor(message = 'Meta token invalid') {
    super(message)
    this.name = 'MetaTokenInvalidError'
  }
}

/** True for a Graph API error body saying the access token is no longer valid. */
export function isInvalidTokenPayload(body: unknown): boolean {
  const err = (body as { error?: { code?: unknown; type?: unknown } } | null)?.error
  if (!err) return false
  return err.code === 190 || err.code === '190'
}

/** Throws MetaTokenInvalidError for a dead token, otherwise an Error with the Graph message. */
export async function throwGraphError(res: Response, label: string): Promise<never> {
  const body = await res.json().catch(() => null)
  if (isInvalidTokenPayload(body)) throw new MetaTokenInvalidError(`${label}: token invalid`)
  const msg = (body as { error?: { message?: string } } | null)?.error?.message
  throw new Error(`${label} failed: ${res.status}${msg ? ` — ${msg}` : ''}`)
}
