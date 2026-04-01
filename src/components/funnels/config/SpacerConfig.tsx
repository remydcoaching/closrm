'use client'

import type { SpacerBlockConfig } from '@/types'

interface Props {
  config: SpacerBlockConfig
  onChange: (config: SpacerBlockConfig) => void
}

export default function SpacerConfig({ config, onChange }: Props) {
  return (
    <div>
      <label style={labelStyle}>Hauteur (px)</label>
      <input
        type="number"
        min={0}
        max={500}
        value={config.height}
        onChange={e => onChange({ ...config, height: Number(e.target.value) || 0 })}
        style={inputStyle}
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
