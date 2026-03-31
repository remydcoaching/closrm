'use client'

import type { TextBlockConfig } from '@/types'

interface Props {
  config: TextBlockConfig
  onChange: (config: TextBlockConfig) => void
}

export default function TextBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Contenu</label>
      <textarea
        value={config.content}
        onChange={e => onChange({ ...config, content: e.target.value })}
        placeholder="Bonjour {{prenom}},

Votre coaching vous attend..."
        rows={4}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 13,
          background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
          color: '#fff', outline: 'none', resize: 'vertical',
        }}
      />
      <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
        Variables : {'{{prenom}}'}, {'{{nom}}'}, {'{{email}}'}, {'{{telephone}}'}, {'{{nom_coach}}'}
      </div>
    </div>
  )
}
