'use client'

/**
 * T-028 Phase 10 — Éditeur du bloc Footer pour l'inspector.
 */

import type { FunnelFooterBlockConfig } from '@/types'

interface Props {
  config: FunnelFooterBlockConfig
  onChange: (config: FunnelFooterBlockConfig) => void
}

export default function FooterConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Nom de la marque</label>
        <input
          type="text"
          value={config.brand}
          onChange={(e) => onChange({ ...config, brand: e.target.value })}
          placeholder="Ma marque"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Année copyright</label>
        <input
          type="number"
          value={config.year}
          onChange={(e) =>
            onChange({ ...config, year: parseInt(e.target.value, 10) || new Date().getFullYear() })
          }
          placeholder={String(new Date().getFullYear())}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte copyright</label>
        <input
          type="text"
          value={config.copyrightText}
          onChange={(e) => onChange({ ...config, copyrightText: e.target.value })}
          placeholder="Tous droits réservés."
          style={inputStyle}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#555',
  display: 'block',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  outline: 'none',
}
