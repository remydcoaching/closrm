'use client'

import type { FunnelImageBlockConfig, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: FunnelImageBlockConfig
  onChange: (config: FunnelImageBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
}

export default function ImageConfig({ config, onChange, pages, blocks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>URL de l&apos;image</label>
        <input
          type="url"
          value={config.src}
          onChange={e => onChange({ ...config, src: e.target.value })}
          placeholder="https://images.unsplash.com/..."
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte alternatif</label>
        <input
          type="text"
          value={config.alt}
          onChange={e => onChange({ ...config, alt: e.target.value })}
          placeholder="Description de l'image"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Largeur (px)</label>
          <input
            type="number"
            value={config.width ?? ''}
            onChange={e => onChange({ ...config, width: e.target.value ? Number(e.target.value) : null })}
            placeholder="Auto"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Alignement</label>
          <select
            value={config.alignment}
            onChange={e => onChange({ ...config, alignment: e.target.value as FunnelImageBlockConfig['alignment'] })}
            style={inputStyle}
          >
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </div>
      </div>
      <RedirectPicker
        value={config.linkUrl}
        onChange={val => onChange({ ...config, linkUrl: val })}
        pages={pages}
        blocks={blocks}
        label="Lien au clic"
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#555', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
