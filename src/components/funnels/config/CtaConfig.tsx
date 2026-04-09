'use client'

import type { CtaBlockConfig, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: CtaBlockConfig
  onChange: (config: CtaBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
}

export default function CtaConfig({ config, onChange, pages, blocks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Texte</label>
        <input
          type="text"
          value={config.text}
          onChange={e => onChange({ ...config, text: e.target.value })}
          placeholder="Réserver maintenant"
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Style</label>
          <select
            value={config.style}
            onChange={e => onChange({ ...config, style: e.target.value as CtaBlockConfig['style'] })}
            style={inputStyle}
          >
            <option value="primary">Primaire</option>
            <option value="secondary">Secondaire</option>
            <option value="outline">Outline</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Taille</label>
          <select
            value={config.size}
            onChange={e => onChange({ ...config, size: e.target.value as CtaBlockConfig['size'] })}
            style={inputStyle}
          >
            <option value="sm">Petit</option>
            <option value="md">Moyen</option>
            <option value="lg">Grand</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Alignement</label>
          <select
            value={config.alignment}
            onChange={e => onChange({ ...config, alignment: e.target.value as CtaBlockConfig['alignment'] })}
            style={inputStyle}
          >
            <option value="left">Gauche</option>
            <option value="center">Centre</option>
            <option value="right">Droite</option>
          </select>
        </div>
      </div>
      <RedirectPicker
        value={config.url || null}
        onChange={val => onChange({ ...config, url: val || '' })}
        pages={pages}
        blocks={blocks}
        label="Lien du bouton"
        required
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
