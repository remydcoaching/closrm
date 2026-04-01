'use client'

import type { HeaderBlockConfig } from '@/types'

interface Props {
  config: HeaderBlockConfig
  onChange: (config: HeaderBlockConfig) => void
}

export default function HeaderBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Titre</label>
          <input
            type="text"
            value={config.title}
            onChange={e => onChange({ ...config, title: e.target.value })}
            placeholder="Mon Coaching"
            style={inputStyle}
          />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Alignement</label>
          <select
            value={config.alignment}
            onChange={e => onChange({ ...config, alignment: e.target.value as HeaderBlockConfig['alignment'] })}
            style={inputStyle}
          >
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>URL du logo (optionnel)</label>
        <input
          type="url"
          value={config.logoUrl || ''}
          onChange={e => onChange({ ...config, logoUrl: e.target.value })}
          placeholder="https://..."
          style={inputStyle}
        />
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
