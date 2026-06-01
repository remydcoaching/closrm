import imageCompression from 'browser-image-compression'
import { useState, useCallback } from 'react'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_INPUT_MB = 15

interface UseImageUploadOptions {
  funnelId: string
  workspaceId: string
}

interface UseImageUploadReturn {
  upload: (file: File) => Promise<string>
  isUploading: boolean
  progress: number
  error: string | null
  reset: () => void
}

export function useImageUpload({ funnelId }: UseImageUploadOptions): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setIsUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  const upload = useCallback(async (file: File): Promise<string> => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      const msg = 'Format non supporté (JPG, PNG, WebP, GIF uniquement)'
      setError(msg)
      throw new Error(msg)
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      const msg = `Fichier trop volumineux (max ${MAX_INPUT_MB} Mo, ton fichier fait ${mb} Mo)`
      setError(msg)
      throw new Error(msg)
    }

    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Étape 1 : compression côté client (10 → 50%)
      setProgress(10)
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        onProgress: (p) => setProgress(10 + Math.round(p * 0.4)),
      })

      // Étape 2 : presigned URL (50%)
      setProgress(50)
      const signRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'funnel_image',
          funnel_id: funnelId,
          content_type: 'image/webp',
          content_length: compressed.size,
        }),
      })

      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error ?? `Erreur serveur (${signRes.status})`)
      }

      const { upload_url, public_url } = await signRes.json() as { upload_url: string; public_url: string }

      // Étape 3 : upload XHR avec progress (55 → 100%)
      setProgress(55)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', upload_url)
        xhr.setRequestHeader('Content-Type', 'image/webp')
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(55 + Math.round((e.loaded / e.total) * 45))
          }
        })
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload échoué (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload"))
        xhr.send(compressed)
      })

      setProgress(100)
      return public_url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(msg)
      throw e
    } finally {
      setIsUploading(false)
    }
  }, [funnelId])

  return { upload, isUploading, progress, error, reset }
}
