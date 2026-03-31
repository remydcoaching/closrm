'use client'

import { WorkflowStatus } from '@/types'

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
  actif: { label: 'Actif', color: 'var(--color-primary)', bg: 'rgba(0,200,83,0.15)' },
  inactif: { label: 'Inactif', color: 'var(--text-tertiary)', bg: 'rgba(136,136,136,0.15)' },
}

export default function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      color: c.color,
      background: c.bg,
    }}>
      {c.label}
    </span>
  )
}
