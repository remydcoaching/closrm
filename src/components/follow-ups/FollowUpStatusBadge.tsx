import { FollowUpStatus } from '@/types'

export const FU_STATUS_CONFIG: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  fait: { label: 'Fait', color: '#00C853', bg: 'rgba(0,200,83,0.12)' },
  annule: { label: 'Annulé', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const c = FU_STATUS_CONFIG[status]
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}
