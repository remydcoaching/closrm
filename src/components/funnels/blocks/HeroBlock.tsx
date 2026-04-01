'use client'

import type { HeroBlockConfig } from '@/types'

interface Props {
  config: HeroBlockConfig
}

export default function HeroBlock({ config }: Props) {
  const hasImage = !!config.backgroundImage

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    padding: '80px 40px',
    textAlign: config.alignment,
    backgroundImage: hasImage
      ? `url(${config.backgroundImage})`
      : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#fff',
    overflow: 'hidden',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: hasImage ? 'rgba(0,0,0,0.55)' : 'transparent',
    zIndex: 0,
  }

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    maxWidth: 800,
    margin: config.alignment === 'center' ? '0 auto' : undefined,
    marginLeft: config.alignment === 'right' ? 'auto' : undefined,
  }

  return (
    <section style={containerStyle}>
      <div style={overlayStyle} />
      <div style={contentStyle}>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, margin: '0 0 16px' }}>
          {config.title || 'Titre principal'}
        </h1>
        {config.subtitle && (
          <p style={{ fontSize: 20, lineHeight: 1.5, margin: '0 0 32px', opacity: 0.9 }}>
            {config.subtitle}
          </p>
        )}
        {config.ctaText && (
          <a
            href={config.ctaUrl || '#'}
            style={{
              display: 'inline-block',
              padding: '14px 36px',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--color-primary, #E53E3E)',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
          >
            {config.ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
