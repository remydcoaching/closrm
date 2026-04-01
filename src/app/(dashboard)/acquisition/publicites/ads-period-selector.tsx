'use client'

import { useState } from 'react'

export type PeriodPreset = 'today' | '7d' | '14d' | '30d' | '90d' | 'custom'

interface AdsPeriodSelectorProps {
  value: PeriodPreset
  dateFrom: string
  dateTo: string
  onChange: (preset: PeriodPreset, dateFrom?: string, dateTo?: string) => void
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7j' },
  { value: '14d', label: '14j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: 'custom', label: 'Personnalisé' },
]

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid var(--border-primary)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: '#1877F2',
  borderColor: '#1877F2',
  color: '#fff',
  fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
}

export default function AdsPeriodSelector({ value, dateFrom, dateTo, onChange }: AdsPeriodSelectorProps) {
  const [showCustom, setShowCustom] = useState(value === 'custom')
  const [localFrom, setLocalFrom] = useState(dateFrom)
  const [localTo, setLocalTo] = useState(dateTo)

  function handlePreset(preset: PeriodPreset) {
    if (preset === 'custom') {
      setShowCustom(true)
      onChange('custom', localFrom, localTo)
    } else {
      setShowCustom(false)
      onChange(preset)
    }
  }

  function handleCustomApply() {
    if (localFrom && localTo) {
      onChange('custom', localFrom, localTo)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map(p => (
        <button
          key={p.value}
          onClick={() => handlePreset(p.value)}
          style={value === p.value ? btnActive : btnBase}
        >
          {p.label}
        </button>
      ))}

      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Du</span>
          <input
            type="date"
            value={localFrom}
            onChange={e => setLocalFrom(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>au</span>
          <input
            type="date"
            value={localTo}
            onChange={e => setLocalTo(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={handleCustomApply}
            style={{
              ...btnBase,
              background: '#1877F2',
              borderColor: '#1877F2',
              color: '#fff',
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
