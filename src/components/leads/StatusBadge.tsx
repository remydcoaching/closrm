'use client'

import { LeadStatus } from '@/types'
import { useStatusEntry } from '@/lib/workspace/config-context'
import { DEFAULT_STATUS_CONFIG } from '@/lib/workspace/status-defaults'

// Legacy export kept for server-side / non-context use cases (e.g. static rendering).
// Prefer useStatusEntry(status) in client components.
export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> =
  Object.fromEntries(
    DEFAULT_STATUS_CONFIG.map((e) => [e.key, { label: e.label, color: e.color, bg: e.bg }]),
  ) as Record<LeadStatus, { label: string; color: string; bg: string }>

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const entry = useStatusEntry(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: entry.color, background: entry.bg,
    }}>
      {entry.label}
    </span>
  )
}
