// Thin HTTP client for the existing ClosRM Next.js API — the SAME contract
// the mobile app already consumes via Authorization: Bearer <jwt>. No new
// backend endpoint is required for M1; getWorkspaceId() on the server side
// already accepts this header.
import { supabase } from './supabase'

const API_BASE_URL = (import.meta.env.VITE_CLOSRM_API_BASE_URL as string) || 'http://localhost:3000'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// A read never waits forever: a stuck server (e.g. a local dev server whose
// outbound fetches hang) used to leave spinners up for minutes and block the
// cache's refresh of that key. Writes keep no limit (syncs, scans can be long).
const READ_TIMEOUT_MS = 60_000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...(init?.headers ?? {}),
  }

  const signal = init?.signal ?? (init?.method === 'GET' ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined)
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError(408, 'Le serveur ne répond pas — réessayez')
    throw err
  }

  if (res.status === 401) {
    throw new ApiError(401, 'Session expirée — reconnexion nécessaire')
  }

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.toString() ?? `Erreur ${res.status}`)
  }

  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
