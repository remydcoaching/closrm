import { supabase } from './supabase'
import { logDebug } from './debugLog'

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL manquant — voir .env.example.')
}

class ApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`)
    this.status = status
    this.body = body
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) {
    void logDebug(`api:getSession error — ${error.message}`)
  }
  if (!session?.access_token) {
    void logDebug('api:getSession — pas de access_token (session absente/expirée)')
    throw new Error('Not authenticated')
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const t0 = Date.now()
  void logDebug(`api:${init.method} ${path} — start`)
  try {
    const headers = { ...(await authHeaders()), ...(init.headers as Record<string, string> | undefined) }
    const tAuth = Date.now()
    void logDebug(`api:${init.method} ${path} — auth OK (${tAuth - t0}ms)`)
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    const tFetch = Date.now()
    if (!res.ok) {
      const body = await res.text()
      // On ne logue jamais le corps de la réponse d'erreur ici : il peut
      // contenir des données sensibles (détails de lead, fragments issus
      // de Supabase...) et ce buffer est copiable/partageable depuis
      // l'écran Logs debug. Juste le statut suffit pour diagnostiquer.
      void logDebug(`api:${init.method} ${path} — HTTP ${res.status} (réseau: ${tFetch - tAuth}ms, total: ${tFetch - t0}ms)`)
      throw new ApiError(res.status, body)
    }
    // Les routes DELETE renvoient parfois 204 No Content.
    if (res.status === 204) {
      void logDebug(`api:${init.method} ${path} — OK 204 (réseau: ${tFetch - tAuth}ms, total: ${Date.now() - t0}ms)`)
      return undefined as unknown as T
    }
    const json = await res.json()
    void logDebug(`api:${init.method} ${path} — OK ${res.status} (réseau: ${tFetch - tAuth}ms, parsing: ${Date.now() - tFetch}ms, total: ${Date.now() - t0}ms)`)
    return json as T
  } catch (e) {
    if (!(e instanceof ApiError)) {
      void logDebug(`api:${init.method} ${path} — exception apres ${Date.now() - t0}ms: ${e instanceof Error ? e.message : String(e)}`)
    }
    throw e
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export { ApiError }
