'use client'

import { WorkflowStatus } from '@/types'

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bg: string; dot: string }> = {
  brouillon: { label: 'Brouillon', color: '#D69E2E', bg: 'rgba(214,158,46,0.12)', dot: '#D69E2E' },
  actif: { label: 'Actif', color: '#38A169', bg: 'rgba(56,161,105,0.12)', dot: '#38A169' },
  inactif: { label: 'Inactif', color: '#A0A0A0', bg: 'rgba(160,160,160,0.12)', dot: '#666' },
}

export default function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      color: c.color,
      background: c.bg,
      letterSpacing: '0.02em',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c.dot,
        flexShrink: 0,
      }} />
      {c.label}
    </span>
  )
}
