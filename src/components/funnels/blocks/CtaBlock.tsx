'use client'

import type { CtaBlockConfig } from '@/types'

interface Props {
  config: CtaBlockConfig
}

const sizeMap: Record<string, React.CSSProperties> = {
  sm: { padding: '8px 20px', fontSize: 14 },
  md: { padding: '12px 28px', fontSize: 16 },
  lg: { padding: '16px 36px', fontSize: 18 },
}

export default function CtaBlock({ config }: Props) {
  const size = sizeMap[config.size] || sizeMap.md

  const alignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  }

  const isOutline = config.style === 'outline'
  const bgColor = isOutline ? 'transparent' : 'var(--color-primary, #E53E3E)'
  const textColor = isOutline ? 'var(--color-primary, #E53E3E)' : '#fff'
  const border = isOutline ? '2px solid var(--color-primary, #E53E3E)' : 'none'

  return (
    <div style={{
      padding: '20px',
      display: 'flex',
      justifyContent: alignMap[config.alignment] || 'center',
    }}>
      <a
        href={config.url || '#'}
        style={{
          ...size,
          display: 'inline-block',
          fontWeight: 600,
          color: textColor,
          background: bgColor,
          border,
          borderRadius: 8,
          textDecoration: 'none',
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        {config.text || 'Cliquez ici'}
      </a>
    </div>
  )
}
