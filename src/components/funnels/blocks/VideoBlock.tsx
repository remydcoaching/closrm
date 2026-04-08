'use client'

/**
 * T-028c — VideoBlock migré vers le design system v2.
 *
 * Bloc d'embed vidéo (YouTube / Vimeo). Adopte le langage visuel du design system :
 * - border-radius 16px (au lieu de 8px) — cohérent avec les cards
 * - ombre colorée via `--fnl-primary-rgb` qui s'adapte au preset
 * - état "vide" coloré via `--fnl-text-secondary` au lieu de #999
 *
 * La logique de parsing YouTube/Vimeo et le mapping aspect-ratio sont préservés
 * tels quels — c'est de la logique métier, pas du design.
 */

import type { VideoBlockConfig } from '@/types'

interface Props {
  config: VideoBlockConfig
}

function parseVideoUrl(url: string): string | null {
  if (!url) return null

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`

  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`

  return null
}

const ASPECT_RATIO_PADDING: Record<string, string> = {
  '16:9': '56.25%',
  '9:16': '177.78%',
  '4:3': '75%',
  '1:1': '100%',
}

export default function VideoBlock({ config }: Props) {
  const embedUrl = parseVideoUrl(config.url)
  const paddingTop = ASPECT_RATIO_PADDING[config.aspectRatio] || '56.25%'

  // État vide : aucune URL configurée ou URL invalide
  if (!embedUrl) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        <div
          style={{
            position: 'relative',
            paddingTop,
            background: 'rgba(var(--fnl-primary-rgb), 0.05)',
            borderRadius: 16,
            border: '2px dashed rgba(var(--fnl-primary-rgb), 0.2)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fnl-text-secondary)',
              fontSize: 14,
            }}
          >
            Aucune vidéo configurée
          </div>
        </div>
      </div>
    )
  }

  // Construction des query params (autoplay, contrôles)
  const params = new URLSearchParams()
  if (config.autoplay) params.set('autoplay', '1')
  if (config.controls === false) params.set('controls', '0')
  const suffix = params.toString() ? `?${params.toString()}` : ''

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <div
        style={{
          position: 'relative',
          paddingTop,
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow:
            '0 15px 50px rgba(var(--fnl-primary-rgb), 0.2), 0 5px 20px rgba(0, 0, 0, 0.1)',
          border: '2px solid rgba(var(--fnl-primary-rgb), 0.15)',
        }}
      >
        <iframe
          src={`${embedUrl}${suffix}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
