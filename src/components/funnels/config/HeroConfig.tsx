'use client'

import type { HeroBlockConfig, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: HeroBlockConfig
  onChange: (config: HeroBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
  funnelId: string
  workspaceId: string
}

export default function HeroConfig({ config, onChange, pages, blocks, funnelId, workspaceId }: Props) {
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
        <label style={labelStyle}>Position du bouton</label>
        <select
          value={config.ctaPosition || 'middle'}
          onChange={e => onChange({ ...config, ctaPosition: e.target.value as HeroBlockConfig['ctaPosition'] })}
          style={inputStyle}
        >
          <option value="top">Supérieure (collé au texte)</option>
          <option value="middle">Milieu (espacement standard)</option>
          <option value="bottom">Inférieure (poussé vers le bas)</option>
        </select>
      </div>
      <ImageUploadField
        value={config.backgroundImage || ''}
        onChange={url => onChange({ ...config, backgroundImage: url || null })}
        funnelId={funnelId}
        workspaceId={workspaceId}
        label="Image de fond"
      />
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
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8,
  color: 'var(--text-primary)', outline: 'none',
}
