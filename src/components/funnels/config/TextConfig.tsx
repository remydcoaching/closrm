'use client'

import type { FunnelTextBlockConfig } from '@/types'

interface Props {
  config: FunnelTextBlockConfig
  onChange: (config: FunnelTextBlockConfig) => void
}

export default function TextConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Contenu</label>
        <textarea
          value={config.content}
          onChange={e => onChange({ ...config, content: e.target.value })}
          rows={6}
          placeholder="Votre texte ici..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
          Variables disponibles : {'{{prenom}}'}, {'{{nom}}'}, {'{{email}}'}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Alignement</label>
        <select
          value={config.alignment}
          onChange={e => onChange({ ...config, alignment: e.target.value as FunnelTextBlockConfig['alignment'] })}
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
