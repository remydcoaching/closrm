import { CallOutcome } from '@/types'

export const OUTCOME_CONFIG: Record<CallOutcome, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  done: { label: 'Fait', color: '#00C853', bg: 'rgba(0,200,83,0.12)' },
  cancelled: { label: 'Annulé', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  no_show: { label: 'Absent', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
}

export default function CallOutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const c = OUTCOME_CONFIG[outcome]
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}
