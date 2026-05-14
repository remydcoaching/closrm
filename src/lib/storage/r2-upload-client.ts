/**
 * Client browser : helpers pour upload PUT direct vers R2 via presigned URL.
 *
 * Usage:
 *   const { path } = await uploadToR2(file, { post_id, target: 'final' })
 *   // path = `workspaces/{wid}/posts/{pid}/final-{uuid}.{ext}`
 *   await updateSlot({ final_url: path })
 */

export type UploadTarget = 'final' | 'media' | 'rush'

export interface UploadResult {
  /** Path canonique a stocker en DB (ex: `workspaces/abc/posts/def/final-uuid.mp4`) */
  path: string
}

interface UploadArgs {
  post_id: string
  target: UploadTarget
  onProgress?: (pct: number) => void
}

export async function uploadToR2(file: File, args: UploadArgs): Promise<UploadResult> {
  // 1. Obtenir une presigned PUT URL
  const signRes = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_id: args.post_id,
      target: args.target,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      content_length: file.size,
    }),
  })

  if (!signRes.ok) {
    const j = await signRes.json().catch(() => ({}))
    throw new Error(j.error ?? `Failed to sign upload (${signRes.status})`)
  }

  const { upload_url, path } = (await signRes.json()) as { upload_url: string; path: string }

  // 2. PUT direct vers R2
  // On utilise XHR au lieu de fetch pour pouvoir tracker la progression
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', upload_url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    if (args.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          args.onProgress!(Math.round((e.loaded / e.total) * 100))
        }
      })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })

  return { path }
}

/**
 * Recupere une URL signee de lecture pour un path R2 stocke en DB.
 * Si l'input est deja une URL https://, on la renvoie telle quelle (compat
 * Supabase Storage public URLs pendant la transition).
 */
export async function resolveR2Url(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  const res = await fetch(`/api/storage/sign?path=${encodeURIComponent(pathOrUrl)}`)
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error ?? `Failed to sign read (${res.status})`)
  }
  const { url } = (await res.json()) as { url: string }
  return url
}

/**
 * Detecte si une valeur stockee en DB est un path R2 (relatif) ou une URL externe.
 */
export function isR2Path(value: string): boolean {
  return value.startsWith('workspaces/')
}
