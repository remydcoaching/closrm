'use client'

import type { FunnelImageBlockConfig } from '@/types'

interface Props {
  config: FunnelImageBlockConfig
}

export default function ImageBlock({ config }: Props) {
  if (!config.src) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#999',
        fontSize: 14,
      }}>
        Aucune image configurée
      </div>
    )
  }

  const marginStyle: React.CSSProperties = {
    left: {},
    center: { marginLeft: 'auto', marginRight: 'auto' },
    right: { marginLeft: 'auto' },
  }[config.alignment || 'center'] || { marginLeft: 'auto', marginRight: 'auto' }

  const img = (
    <img
      src={config.src}
      alt={config.alt || ''}
      style={{
        display: 'block',
        maxWidth: '100%',
        width: config.width ? config.width : undefined,
        borderRadius: 8,
        ...marginStyle,
      }}
    />
  )

  return (
    <div style={{ padding: '20px' }}>
      {config.linkUrl ? (
        <a href={config.linkUrl} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  )
}
