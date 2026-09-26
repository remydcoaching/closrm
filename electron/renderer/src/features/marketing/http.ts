// Extra HTTP calls the marketing modules need beyond lib/api-client.ts:
// body-less POST action routes, multipart POST
// (Instagram image DM) and POST returning raw HTML (email template preview).
// Same auth contract as lib/api-client.ts (Bearer JWT from the Supabase
// session, same API base URL) — no new backend mechanism.
import { supabase } from '../../lib/supabase'
import { ApiError } from '../../lib/api-client'

const API_BASE_URL = (import.meta.env.VITE_CLOSRM_API_BASE_URL as string) || 'http://localhost:3000'

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function raw(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(await authHeader()), ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new ApiError(401, 'Session expirée — reconnexion nécessaire')
  return res
}

async function asJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body && typeof body === 'object' && 'error' in body ? (body as { error: unknown }).error : null
    throw new ApiError(res.status, typeof err === 'string' ? err : `Erreur ${res.status}`)
  }
  return body as T
}

/** POST without a JSON body (the /publish, /activate… action routes). */
export async function apiPostEmpty<T>(path: string): Promise<T> {
  const res = await raw(path, { method: 'POST' })
  return asJson<T>(res)
}

/** multipart/form-data POST — the browser sets the boundary header itself. */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await raw(path, { method: 'POST', body: form })
  return asJson<T>(res)
}

/** JSON POST whose response is text/html (email preview compilers). */
export async function apiPostText(path: string, data: unknown): Promise<string> {
  const res = await raw(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const text = await res.text()
  if (!res.ok) throw new ApiError(res.status, `Erreur ${res.status}`)
  return text
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Erreur inconnue'
}
