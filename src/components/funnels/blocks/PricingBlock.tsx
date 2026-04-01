'use client'

import type { PricingBlockConfig } from '@/types'

interface Props {
  config: PricingBlockConfig
}

export default function PricingBlock({ config }: Props) {
  const isHighlighted = config.highlighted

  return (
    <div style={{ padding: '40px 20px', maxWidth: 400, margin: '0 auto' }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 32px',
        boxShadow: isHighlighted
          ? '0 8px 30px rgba(229,62,62,0.15)'
          : '0 2px 12px rgba(0,0,0,0.08)',
        border: isHighlighted ? '2px solid var(--color-primary, #E53E3E)' : '1px solid #eee',
        textAlign: 'center',
      }}>
        {config.title && (
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>
            {config.title}
          </h3>
        )}
        <div style={{ margin: '0 0 8px' }}>
          <span style={{ fontSize: 48, fontWeight: 800, color: '#111' }}>{config.price}</span>
          {config.currency && (
            <span style={{ fontSize: 20, fontWeight: 600, color: '#555', marginLeft: 4 }}>{config.currency}</span>
          )}
        </div>
        {config.period && (
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px' }}>/{config.period}</p>
        )}
        {config.features && config.features.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', textAlign: 'left' }}>
            {config.features.map((feat, i) => (
              <li key={i} style={{
                padding: '8px 0',
                fontSize: 15,
                color: '#444',
                borderBottom: i < config.features.length - 1 ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ color: '#38A169', fontWeight: 700 }}>✓</span>
                {feat}
              </li>
            ))}
          </ul>
        )}
        {config.ctaText && (
          <a
            href={config.ctaUrl || '#'}
            style={{
              display: 'inline-block',
              width: '100%',
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--color-primary, #E53E3E)',
              borderRadius: 8,
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            {config.ctaText}
          </a>
        )}
      </div>
    </div>
  )
}
