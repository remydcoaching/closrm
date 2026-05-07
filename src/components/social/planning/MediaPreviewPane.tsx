'use client'

import { ExternalLink } from 'lucide-react'

type MediaKind = 'video' | 'image' | 'link'

interface MediaPreviewPaneProps {
  url: string
  kind: MediaKind
  label?: string
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i

export function inferMediaKind(url: string): MediaKind {
  if (VIDEO_RE.test(url)) return 'video'
  if (IMAGE_RE.test(url)) return 'image'
  return 'link'
}

export default function MediaPreviewPane({ url, kind, label }: MediaPreviewPaneProps) {
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
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {kind === 'video' && (
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )}
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label ?? 'Aperçu média'}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        )}
        {kind === 'link' && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 24,
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
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
}
