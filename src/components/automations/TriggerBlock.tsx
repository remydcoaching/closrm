'use client'

import { Zap } from 'lucide-react'
import { WorkflowTriggerType } from '@/types'
import { triggerLabels } from '@/components/automations/WorkflowCard'

interface Props {
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  selected: boolean
  onClick: () => void
}

export default function TriggerBlock({ triggerType, triggerConfig, selected, onClick }: Props) {
  const configEntries = Object.entries(triggerConfig).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-elevated)',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        minWidth: 320,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Zap size={16} style={{ color: 'var(--color-primary)' }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Trigger
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {triggerLabels[triggerType] || triggerType}
      </div>

      {configEntries.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {configEntries.map(([key, value]) => (
            <div key={key}>
              {key}: {String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
