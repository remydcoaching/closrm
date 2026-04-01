'use client'

import type { WorkflowStep } from '@/types'

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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  display: 'block',
}

export default function WaitForEventConfigPanel({ step, onChange }: Props) {
  const config = step.action_config || {}

  const updateConfig = (key: string, value: unknown) => {
    onChange({ action_config: { ...config, [key]: value } })
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
        Attendre un événement
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Type d&apos;événement</label>
        <select
          style={{ ...inputStyle, appearance: 'none' as const }}
          value={(config.event_type as string) || ''}
          onChange={(e) => updateConfig('event_type', e.target.value)}
        >
          <option value="" disabled>Sélectionner...</option>
          <option value="before_call">Avant un appel planifié</option>
          <option value="before_booking">Avant un booking</option>
        </select>
      </div>

      {((config.event_type === 'before_call') || (config.event_type === 'before_booking')) && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Combien d&apos;heures avant ?</label>
          <input
            type="number"
            style={inputStyle}
            min={0}
            value={(config.hours_before as number) ?? 24}
            onChange={(e) => updateConfig('hours_before', parseInt(e.target.value) || 0)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Ex : 24 = le workflow reprendra 24h avant le RDV du lead
          </div>
        </div>
      )}

      <div style={{
        background: 'rgba(249,115,22,0.08)',
        border: '1px solid rgba(249,115,22,0.2)',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: '#F97316',
        lineHeight: 1.5,
        marginTop: 16,
      }}>
        Le workflow se mettra en pause ici et reprendra automatiquement X heures avant l&apos;événement du lead.
      </div>
    </div>
  )
}
