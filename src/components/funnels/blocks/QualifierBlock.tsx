'use client'

// T-048 — Bloc "C'est pour toi / Pas pour toi" : deux colonnes de
// qualification. Couleurs vert/rouge fixes (sémantiques), indépendantes
// du thème --fnl-primary — cohérent avec l'exemple ✓/✕ de la demande.

import type { QualifierBlockConfig, QualifierColumn } from '@/types'
import { ICON_PICKER_ICONS } from '../config/IconPicker'

interface Props {
  config: QualifierBlockConfig
}

function ColumnCard({ column, variant }: { column: QualifierColumn; variant: 'yes' | 'no' }) {
  const accent = variant === 'yes' ? '#38A169' : '#E53E3E'
  const mark = variant === 'yes' ? '✓' : '✕'
  const Icon = column.icon?.name ? ICON_PICKER_ICONS[column.icon.name] : null
  const items = column.items || []

  return (
    <div
      style={{
        background: 'var(--fnl-section-bg)',
        borderRadius: 20,
        padding: '32px 28px',
        border: `1px solid ${accent}33`,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {Icon && <Icon size={22} color={accent} />}
        <h3 style={{ fontSize: 20, fontWeight: 800, color: accent, margin: 0 }}>{column.title}</h3>
      </div>
      {column.subtitle && (
        <p style={{ fontSize: 14, color: 'var(--fnl-text-secondary)', margin: '0 0 20px' }}>{column.subtitle}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: column.subtitle ? 0 : '20px 0 0' }}>
        {items.map(item => (
          <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
            <span style={{ color: accent, fontWeight: 900, fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>{mark}</span>
            <span style={{ fontSize: 15, color: 'var(--fnl-text)', lineHeight: 1.5 }}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function QualifierBlock({ config }: Props) {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
        }}
      >
        <ColumnCard column={config.yes} variant="yes" />
        <ColumnCard column={config.no} variant="no" />
      </div>
    </div>
  )
}
