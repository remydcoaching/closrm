'use client'

import type { VideoBlockConfig } from '@/types'

interface Props {
  config: VideoBlockConfig
  onChange: (config: VideoBlockConfig) => void
}

export default function VideoConfig({ config, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>URL de la vidéo (YouTube ou Vimeo)</label>
        <input
          type="url"
          value={config.url}
          onChange={e => onChange({ ...config, url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ fontSize: 13, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.autoplay}
            onChange={e => onChange({ ...config, autoplay: e.target.checked })}
            style={{ accentColor: 'var(--color-primary, #E53E3E)' }}
          />
          Lecture automatique
        </label>
      </div>
      <div>
        <label style={labelStyle}>Ratio</label>
        <select
          value={config.aspectRatio}
          onChange={e => onChange({ ...config, aspectRatio: e.target.value as VideoBlockConfig['aspectRatio'] })}
          style={inputStyle}
        >
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
          <option value="1:1">1:1</option>
          <option value="9:16">9:16</option>
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
