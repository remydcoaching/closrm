'use client'

import type { HeroBlockConfig, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: HeroBlockConfig
  onChange: (config: HeroBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
}

export default function HeroConfig({ config, onChange, pages, blocks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Badge (au-dessus du titre)</label>
        <input
          type="text"
          value={config.badgeText || ''}
          onChange={e => onChange({ ...config, badgeText: e.target.value })}
          placeholder="Atelier 100% Gratuit"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Votre titre principal"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre</label>
        <input
          type="text"
          value={config.subtitle}
          onChange={e => onChange({ ...config, subtitle: e.target.value })}
          placeholder="Description courte"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte du bouton</label>
        <input
          type="text"
          value={config.ctaText}
          onChange={e => onChange({ ...config, ctaText: e.target.value })}
          placeholder="Réserver un appel"
          style={inputStyle}
        />
      </div>
      <RedirectPicker
        value={config.ctaUrl || null}
        onChange={val => onChange({ ...config, ctaUrl: val || '' })}
        pages={pages}
        blocks={blocks}
        label="Lien du bouton"
        required
      />
      <div>
        <label style={labelStyle}>Image de fond (URL)</label>
        <input
          type="url"
          value={config.backgroundImage || ''}
          onChange={e => onChange({ ...config, backgroundImage: e.target.value || null })}
          placeholder="https://images.unsplash.com/..."
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Alignement</label>
        <select
          value={config.alignment}
          onChange={e => onChange({ ...config, alignment: e.target.value as HeroBlockConfig['alignment'] })}
          style={inputStyle}
        >
          <option value="left">Gauche</option>
          <option value="center">Centre</option>
          <option value="right">Droite</option>
        </select>
      </div>
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
