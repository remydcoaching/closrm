'use client'

import { useEffect, useState, forwardRef } from 'react'
import { ExternalLink } from 'lucide-react'
import { resolveR2Url } from '@/lib/storage/r2-upload-client'
import VideoReviewPlayer, { type VideoAnnotation, type VideoReviewPlayerHandle } from './VideoReviewPlayer'

type MediaKind = 'video' | 'image' | 'link'

interface MediaPreviewPaneProps {
  url: string
  kind: MediaKind
  label?: string
  annotations?: VideoAnnotation[]
  onAddAnnotation?: (timestampSeconds: number, body: string) => Promise<void>
  onAnnotationClick?: (annotationId: string) => void
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i

export function inferMediaKind(url: string): MediaKind {
  if (VIDEO_RE.test(url)) return 'video'
  if (IMAGE_RE.test(url)) return 'image'
  return 'link'
}

const MediaPreviewPane = forwardRef<VideoReviewPlayerHandle, MediaPreviewPaneProps>(
  function MediaPreviewPane({ url, kind, label, annotations, onAddAnnotation, onAnnotationClick }, ref) {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false
      setResolvedUrl(null)
      setError(null)
      resolveR2Url(url)
        .then((u) => { if (!cancelled) setResolvedUrl(u) })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur') })
      return () => { cancelled = true }
    }, [url])

    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          padding: 18,
          gap: 10,
        }}
      >
        {label && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {label}
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'center',
            background: kind === 'video' ? 'transparent' : '#000',
            borderRadius: kind === 'video' ? 0 : 10,
            overflow: 'hidden',
          }}
        >
          {error && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 16, textAlign: 'center' }}>
              Erreur de chargement: {error}
            </div>
          )}
          {!error && !resolvedUrl && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', padding: 24 }}>Chargement…</div>
          )}
          {resolvedUrl && kind === 'video' && (
            <VideoReviewPlayer
              ref={ref}
              url={resolvedUrl}
              annotations={annotations ?? []}
              onAddAnnotation={onAddAnnotation ?? (async () => { /* noop si pas de handler */ })}
              onAnnotationClick={onAnnotationClick}
            />
          )}
          {resolvedUrl && kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={label ?? 'Aperçu média'}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
          {resolvedUrl && kind === 'link' && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 24, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
              }}
            >
              <ExternalLink size={32} />
              <span>Ouvrir le lien</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all', textAlign: 'center', maxWidth: 320 }}>
                {url.length > 80 ? `${url.slice(0, 80)}…` : url}
              </span>
            </a>
          )}
        </div>
      </div>
    )
  },
)

export default MediaPreviewPane
