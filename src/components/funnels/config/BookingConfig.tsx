'use client'

import { useState, useEffect } from 'react'
import type { BookingBlockConfig } from '@/types'

interface Props {
  config: BookingBlockConfig
  onChange: (config: BookingBlockConfig) => void
}

interface CalendarOption {
  id: string
  name: string
}

export default function BookingConfig({ config, onChange }: Props) {
  const [calendars, setCalendars] = useState<CalendarOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/booking-calendars')
      .then(res => res.ok ? res.json() : [])
      .then(data => setCalendars(Array.isArray(data) ? data : []))
      .catch(() => setCalendars([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Réservez votre appel"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre</label>
        <input
          type="text"
          value={config.subtitle}
          onChange={e => onChange({ ...config, subtitle: e.target.value })}
          placeholder="Choisissez un créneau"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Calendrier</label>
        {loading ? (
          <div style={{ fontSize: 12, color: '#666', padding: '8px 0' }}>Chargement...</div>
        ) : (
          <select
            value={config.calendarId || ''}
            onChange={e => onChange({ ...config, calendarId: e.target.value || null })}
            style={inputStyle}
          >
            <option value="">Sélectionner un calendrier</option>
            {calendars.map(cal => (
              <option key={cal.id} value={cal.id}>{cal.name}</option>
            ))}
          </select>
        )}
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
