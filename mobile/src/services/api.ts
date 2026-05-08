import { supabase } from './supabase'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL

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
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = { ...(await authHeaders()), ...(init.headers as Record<string, string> | undefined) }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  // Les routes DELETE renvoient parfois 204 No Content.
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
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
