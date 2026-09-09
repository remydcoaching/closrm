'use client'

// T-048 — Bloc "Programme / Méthode" : grille de cartes numérotées
// présentant les étapes de l'accompagnement.

import type { ProgramBlockConfig } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: ProgramBlockConfig
}

const MINMAX_BY_COLUMNS: Record<2 | 3 | 4, number> = { 2: 380, 3: 280, 4: 220 }

export default function ProgramBlock({ config }: Props) {
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
        {items.map(item => {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--fnl-primary)', lineHeight: 1, fontFamily: 'Poppins, sans-serif' }}>
                  {item.number}
                </span>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 10 }} />
                ) : Icon ? (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--fnl-primary-rgb), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="var(--fnl-primary)" />
                  </div>
                ) : null}
              </div>
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
