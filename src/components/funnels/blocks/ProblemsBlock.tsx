'use client'

// T-048 — Bloc "Problèmes" : grille de cartes présentant les problèmes de
// la cible, pour qu'elle se reconnaisse dans sa situation actuelle.

import type { ProblemsBlockConfig } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: ProblemsBlockConfig
}

const MINMAX_BY_COLUMNS: Record<1 | 2 | 3, number> = { 1: 480, 2: 320, 3: 260 }

export default function ProblemsBlock({ config }: Props) {
  const items = config.items || []
  if (items.length === 0) return null

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--fnl-text)', margin: '0 0 12px', textAlign: 'center', lineHeight: 1.3 }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 16, color: 'var(--fnl-text-secondary)', textAlign: 'center', margin: '0 0 36px' }}>
          {config.subtitle}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${MINMAX_BY_COLUMNS[config.columns]}px, 1fr))`,
          gap: 24,
        }}
      >
        {items.map((item, i) => {
          const Icon = item.icon?.name ? ICON_PICKER_ICONS[item.icon.name] : null
          return (
            <div
              key={item.id}
              style={{
                background: 'var(--fnl-section-bg)',
                borderRadius: 20,
                padding: '28px 24px',
                border: '1px solid rgba(var(--fnl-primary-rgb), 0.15)',
                boxShadow: '0 8px 30px rgba(var(--fnl-primary-rgb), 0.1), 0 2px 10px rgba(0, 0, 0, 0.05)',
                textAlign: 'left',
              }}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
              ) : Icon ? (
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(var(--fnl-primary-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={24} color="var(--fnl-primary)" />
                </div>
              ) : null}
              {item.showNumber && (
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fnl-primary)', letterSpacing: '0.05em', marginBottom: 6 }}>
                  PROBLÈME {String(i + 1).padStart(2, '0')}
                </div>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fnl-text)', margin: '0 0 8px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--fnl-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {item.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
