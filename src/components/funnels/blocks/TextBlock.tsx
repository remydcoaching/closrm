'use client'

import type { FunnelTextBlockConfig } from '@/types'

interface Props {
  config: FunnelTextBlockConfig
}

export default function TextBlock({ config }: Props) {
  const lines = (config.content || '').split('\n')

  return (
    <div style={{
      padding: '24px 20px',
      maxWidth: 720,
      margin: '0 auto',
      fontSize: 16,
      lineHeight: 1.6,
      color: '#333',
      textAlign: config.alignment || 'left',
    }}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  )
}
