'use client'

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

export default function VideoBlock({ config }: Props) {
  const embedUrl = parseVideoUrl(config.url)

  const aspectMap: Record<string, string> = {
    '16:9': '56.25%',
    '9:16': '177.78%',
    '4:3': '75%',
    '1:1': '100%',
  }

  const paddingTop = aspectMap[config.aspectRatio] || '56.25%'

  if (!embedUrl) {
    return (
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <div style={{
          position: 'relative',
          paddingTop,
          background: '#f0f0f0',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: 14,
          }}>
            Aucune vidéo configurée
          </div>
        </div>
      </div>
    )
  }

  const params = new URLSearchParams()
  if (config.autoplay) params.set('autoplay', '1')
  if (config.controls === false) params.set('controls', '0')
  const suffix = params.toString() ? `?${params.toString()}` : ''

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ position: 'relative', paddingTop, overflow: 'hidden', borderRadius: 8 }}>
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
