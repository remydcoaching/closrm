import { LeadStatus } from '@/types'

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  nouveau: { label: 'Nouveau', color: '#a0a0a0', bg: 'rgba(160,160,160,0.12)' },
  setting_planifie: { label: 'Setting planifié', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  no_show_setting: { label: 'No-show Setting', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  closing_planifie: { label: 'Closing planifié', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  no_show_closing: { label: 'No-show Closing', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  clos: { label: 'Closé ✅', color: '#00C853', bg: 'rgba(0,200,83,0.12)' },
  dead: { label: 'Dead ❌', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: config.color, background: config.bg,
    }}>
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
