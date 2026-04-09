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
        background: selected ? 'rgba(229,62,62,0.06)' : 'var(--bg-elevated)',
        border: `2px solid ${selected ? '#E53E3E' : 'var(--border-primary)'}`,
        borderRadius: 14,
        padding: '18px 22px',
        minWidth: 320,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: selected ? '0 0 0 3px rgba(229,62,62,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'rgba(229,62,62,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={14} style={{ color: '#E53E3E' }} />
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#E53E3E',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          Declencheur
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 38 }}>
        {triggerLabels[triggerType] || triggerType}
      </div>

      {configEntries.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 38 }}>
          {configEntries.map(([key, value]) => (
            <div key={key} style={{ marginBottom: 1 }}>
              {key}: {String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
