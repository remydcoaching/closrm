'use client'

import type { ButtonBlockConfig } from '@/types'

interface Props {
  config: ButtonBlockConfig
  onChange: (config: ButtonBlockConfig) => void
}

export default function ButtonBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Texte du bouton</label>
          <input
            type="text"
            value={config.text}
            onChange={e => onChange({ ...config, text: e.target.value })}
            placeholder="Réserver mon appel"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>URL</label>
          <input
            type="url"
            value={config.url}
            onChange={e => onChange({ ...config, url: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 80 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Couleur</label>
          <input
            type="color"
            value={config.color}
            onChange={e => onChange({ ...config, color: e.target.value })}
            style={{ width: '100%', height: 34, border: '1px solid #333', borderRadius: 8, background: '#0a0a0a', cursor: 'pointer' }}
          />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Alignement</label>
          <select
            value={config.alignment}
            onChange={e => onChange({ ...config, alignment: e.target.value as ButtonBlockConfig['alignment'] })}
            style={inputStyle}
          >
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
