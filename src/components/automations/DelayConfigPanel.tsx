'use client'

import type { WorkflowStep, DelayUnit } from '@/types'

interface Props {
  step: WorkflowStep
  onChange: (updates: Partial<WorkflowStep>) => void
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  width: '100%',
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  display: 'block',
}

const UNIT_LABELS: Record<string, string> = {
  minutes: 'minutes',
  hours: 'heures',
  days: 'jours',
}

export default function DelayConfigPanel({ step, onChange }: Props) {
  const value = step.delay_value ?? 1
  const unit = step.delay_unit ?? 'hours'

  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}
      >
        Configuration du délai
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Durée</label>
        <input
          type="number"
          style={inputStyle}
          min={1}
          value={value}
          onChange={(e) => onChange({ delay_value: parseInt(e.target.value) || 1 })}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Unité</label>
        <select
          style={selectStyle}
          value={unit}
          onChange={(e) => onChange({ delay_unit: e.target.value as DelayUnit })}
        >
          <option value="minutes">Minutes</option>
          <option value="hours">Heures</option>
          <option value="days">Jours</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
        Le workflow attendra {value} {UNIT_LABELS[unit]} avant de continuer.
      </div>
    </div>
  )
}
