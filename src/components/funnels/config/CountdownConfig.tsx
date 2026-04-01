'use client'

import type { CountdownBlockConfig } from '@/types'

interface Props {
  config: CountdownBlockConfig
  onChange: (config: CountdownBlockConfig) => void
}

export default function CountdownConfig({ config, onChange }: Props) {
  // Convert ISO string to datetime-local format for the input
  const datetimeValue = config.targetDate
    ? config.targetDate.slice(0, 16)
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="L'offre expire dans..."
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Date cible</label>
        <input
          type="datetime-local"
          value={datetimeValue}
          onChange={e => onChange({ ...config, targetDate: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Message après expiration</label>
        <input
          type="text"
          value={config.expiredMessage}
          onChange={e => onChange({ ...config, expiredMessage: e.target.value })}
          placeholder="Cette offre a expiré."
          style={inputStyle}
        />
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
