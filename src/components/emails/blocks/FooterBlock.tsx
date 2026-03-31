'use client'

import type { FooterBlockConfig } from '@/types'

interface Props {
  config: FooterBlockConfig
  onChange: (config: FooterBlockConfig) => void
}

export default function FooterBlock({ config, onChange }: Props) {
  return (
    <div style={{ padding: '12px 0' }}>
      <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Texte du footer</label>
      <input
        type="text"
        value={config.text}
        onChange={e => onChange({ ...config, text: e.target.value })}
        placeholder="© 2026 Mon Coaching. Tous droits réservés."
        style={{
          width: '100%', padding: '7px 10px', fontSize: 13,
          background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
          color: '#fff', outline: 'none',
        }}
      />
      <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
        Le lien de désinscription sera ajouté automatiquement sous ce texte.
      </div>
    </div>
  )
}
