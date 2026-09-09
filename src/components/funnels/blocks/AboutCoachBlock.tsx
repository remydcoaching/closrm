'use client'

// T-048 — Bloc "Présentation du coach" : image + texte + stats
// d'autorité, layout image-gauche/droite. Utilise flex-wrap plutôt qu'une
// media query dédiée — même logique de dégradation douce que les grilles
// auto-fit des autres blocs.

import type { AboutCoachBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: AboutCoachBlockConfig
}

export default function AboutCoachBlock({ config }: Props) {
  const isImageRight = config.layout === 'image-right'
  const stats = config.stats || []

  const imageEl = config.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.imageUrl}
      alt={config.title}
      style={{ width: '100%', height: 'auto', borderRadius: 20, display: 'block', objectFit: 'cover' }}
    />
  ) : null

  const textEl = (
    <div style={{ flex: '1 1 360px', minWidth: 0 }}>
      {config.title && (
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--fnl-text)', margin: '0 0 8px', lineHeight: 1.3 }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fnl-primary)', margin: '0 0 16px' }}>
          {config.subtitle}
        </p>
      )}
      {config.text && (
        <p style={{ fontSize: 15, color: 'var(--fnl-text-secondary)', lineHeight: 1.7, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
          {config.text}
        </p>
      )}
      {stats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, margin: '0 0 24px' }}>
          {stats.map(stat => (
            <div key={stat.id}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--fnl-primary)', lineHeight: 1, fontFamily: 'Poppins, sans-serif' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fnl-text-secondary)', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}
      {config.ctaText && (
        <a href={resolveFunnelUrl(config.ctaUrl)} className="fnl-btn">
          {config.ctaText}
        </a>
      )}
    </div>
  )

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
        {imageEl && (
          <div style={{ flex: '1 1 320px', minWidth: 0, order: isImageRight ? 2 : 0 }}>
            {imageEl}
          </div>
        )}
        {textEl}
      </div>
    </div>
  )
}
