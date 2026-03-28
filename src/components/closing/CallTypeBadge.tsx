import { CallType } from '@/types'

const TYPE_CONFIG: Record<CallType, { label: string; color: string; bg: string }> = {
  setting: { label: 'Setting', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  closing: { label: 'Closing', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
}

export default function CallTypeBadge({ type }: { type: CallType }) {
  const c = TYPE_CONFIG[type]
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg }}>
      {c.label}
    </span>
  )
}
