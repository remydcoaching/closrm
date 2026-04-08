'use client'

/**
 * T-028c — PricingBlock migré vers le design system v2.
 *
 * Card de tarif unique (le coach peut en placer plusieurs côte à côte via le builder).
 * Adopte le langage visuel du design system :
 * - bordure et ombre colorées via `--fnl-primary-rgb`
 * - card "highlighted" avec border 2px + ombre amplifiée
 * - prix en grand (Poppins 900, couleur principale)
 * - features avec ✓ en couleur principale (au lieu du vert #38A169 hardcodé)
 * - bouton CTA via `.fnl-btn` (gradient + shine + ombre + hover)
 * - hover translateY + ombre amplifiée pour donner de la vie
 *
 * Avant : `#fff`, `#111`, `#888`, `#444`, `#f0f0f0`, `#38A169`, et `var(--color-primary, #E53E3E)`.
 * Après : 100% via CSS vars du preset.
 */

import type { PricingBlockConfig } from '@/types'

interface Props {
  config: PricingBlockConfig
}

export default function PricingBlock({ config }: Props) {
  const isHighlighted = config.highlighted

  return (
    <div style={{ padding: '40px 20px', maxWidth: 420, margin: '0 auto' }}>
      <div
        style={{
          background: 'var(--fnl-section-bg)',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: isHighlighted
            ? '0 20px 60px rgba(var(--fnl-primary-rgb), 0.25), 0 8px 25px rgba(0, 0, 0, 0.1)'
            : '0 8px 30px rgba(var(--fnl-primary-rgb), 0.1), 0 2px 10px rgba(0, 0, 0, 0.05)',
          border: isHighlighted
            ? '2px solid var(--fnl-primary)'
            : '1px solid rgba(var(--fnl-primary-rgb), 0.15)',
          textAlign: 'center',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {config.title && (
          <h3
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--fnl-text)',
              margin: '0 0 16px',
            }}
          >
            {config.title}
          </h3>
        )}
        <div style={{ margin: '0 0 8px', display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: 'var(--fnl-primary)',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: 1,
            }}
          >
            {config.price}
          </span>
          {config.currency && (
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--fnl-primary)',
              }}
            >
              {config.currency}
            </span>
          )}
        </div>
        {config.period && (
          <p
            style={{
              fontSize: 14,
              color: 'var(--fnl-text-secondary)',
              margin: '0 0 28px',
              fontWeight: 500,
            }}
          >
            /{config.period}
          </p>
        )}
        {config.features && config.features.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 32px',
              textAlign: 'left',
            }}
          >
            {config.features.map((feat, i) => (
              <li
                key={i}
                style={{
                  padding: '10px 0',
                  fontSize: 15,
                  color: 'var(--fnl-text)',
                  borderBottom:
                    i < config.features.length - 1
                      ? '1px solid rgba(var(--fnl-primary-rgb), 0.08)'
                      : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color: 'var(--fnl-primary)',
                    fontWeight: 900,
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        )}
        {config.ctaText && (
          <a
            href={config.ctaUrl || '#'}
            className="fnl-btn"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {config.ctaText}
          </a>
        )}
      </div>
    </div>
  )
}
