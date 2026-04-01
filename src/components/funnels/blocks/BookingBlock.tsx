'use client'

import type { BookingBlockConfig } from '@/types'

interface Props {
  config: BookingBlockConfig
}

export default function BookingBlock({ config }: Props) {
  return (
    <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto' }}>
      {config.title && (
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: '#111', textAlign: 'center' }}>
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p style={{ fontSize: 15, color: '#666', margin: '0 0 24px', textAlign: 'center' }}>
          {config.subtitle}
        </p>
      )}
      <div style={{
        border: '2px dashed #ddd',
        borderRadius: 12,
        padding: '48px 24px',
        textAlign: 'center',
        background: '#fafafa',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#333', margin: '0 0 8px' }}>
          Booking intégré
        </p>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
          Calendrier : {config.calendarId || 'non configuré'}
        </p>
      </div>
    </div>
  )
}
