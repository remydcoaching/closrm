'use client'

import type { DividerBlockConfig } from '@/types'

interface Props {
  config: DividerBlockConfig
  onChange: (config: DividerBlockConfig) => void
}

export default function DividerBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0', display: 'flex', gap: 8 }}>
      <div style={{ width: 80 }}>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Couleur</label>
        <input
          type="color"
          value={config.color || '#e4e4e7'}
          onChange={e => onChange({ ...config, color: e.target.value })}
          style={{ width: '100%', height: 34, border: '1px solid #333', borderRadius: 8, background: '#0a0a0a', cursor: 'pointer' }}
        />
      </div>
      <div style={{ width: 100 }}>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Espacement</label>
        <input
          type="number"
          value={config.spacing || 16}
          onChange={e => onChange({ ...config, spacing: Number(e.target.value) })}
          style={{
            width: '100%', padding: '7px 10px', fontSize: 13,
            background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
            color: '#fff', outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
