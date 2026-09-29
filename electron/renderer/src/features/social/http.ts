// Local HTTP helper for the social + settings features. The shared
// lib/api-client only exposes GET/POST/PATCH/DELETE (JSON, no DELETE body),
// but several existing web routes need PUT (/api/social/trame,
// /api/instagram/pillars…), DELETE with a JSON body (/api/instagram/pillars,
// hashtag-groups, caption-templates), or multipart uploads (/api/user/avatar,
// /api/workspaces/logo). Same auth contract: Bearer JWT from the Supabase
// session, same base URL.
import { supabase } from '../../lib/supabase'
import { ApiError } from '../../lib/api-client'

const API_BASE_URL = (import.meta.env.VITE_CLOSRM_API_BASE_URL as string) || 'http://localhost:3000'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Turns a zod `error.flatten()` payload (or a string) into a readable message. */
export function describeApiError(raw: unknown, status: number): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const r = raw as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> }
    const parts = [...(r.formErrors ?? []), ...Object.values(r.fieldErrors ?? {}).flatMap((v) => v ?? [])]
    if (parts.length > 0) return parts.join(', ')
  }
  return `Erreur ${status}`
}

export async function http<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const headers: Record<string, string> = { ...(await authHeader()) }
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  })
  if (res.status === 401) throw new ApiError(401, 'Session expirée — reconnexion nécessaire')
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = json && typeof json === 'object' ? (json as { error?: unknown }).error : undefined
    throw new ApiError(res.status, describeApiError(err, res.status))
  }
  return json as T
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur inconnue'
}

/** Same flow as the web's lib/storage/r2-upload-client: presigned PUT to R2. */
export async function uploadToR2(
  file: File,
  args: { post_id: string; target: 'final' | 'media' | 'rush'; onProgress?: (pct: number) => void },
): Promise<{ path: string }> {
  const { upload_url, path } = await http<{ upload_url: string; path: string }>('POST', '/api/storage/upload-url', {
    post_id: args.post_id,
    target: args.target,
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    content_length: file.size,
  })
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', upload_url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && args.onProgress) args.onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload échoué (${xhr.status})`)))
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload"))
    xhr.send(file)
  })
  return { path }
}

/** R2 paths (workspaces/…) need a signed read URL; plain URLs pass through. */
export async function resolveMediaUrl(pathOrUrl: string): Promise<string> {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  const { url } = await http<{ url: string }>('GET', `/api/storage/sign?path=${encodeURIComponent(pathOrUrl)}`)
  return url
}
