'use client'

import type { ImageBlockConfig } from '@/types'

interface Props {
  config: ImageBlockConfig
  onChange: (config: ImageBlockConfig) => void
}

export default function ImageBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>URL de l&apos;image</label>
          <input
            type="url"
            value={config.src}
            onChange={e => onChange({ ...config, src: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
        <div style={{ width: 100 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Largeur</label>
          <input
            type="number"
            value={config.width || ''}
            onChange={e => onChange({ ...config, width: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Auto"
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Texte alternatif</label>
          <input
            type="text"
            value={config.alt}
            onChange={e => onChange({ ...config, alt: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Alignement</label>
          <select
            value={config.alignment}
            onChange={e => onChange({ ...config, alignment: e.target.value as ImageBlockConfig['alignment'] })}
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
