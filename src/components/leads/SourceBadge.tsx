'use client'

import { LeadSource } from '@/types'
import { useSourceEntry } from '@/lib/workspace/config-context'
import { DEFAULT_SOURCE_CONFIG } from '@/lib/workspace/source-defaults'

// Legacy export kept for non-context use cases.
export const SOURCE_CONFIG: Record<LeadSource, { label: string; color: string; bg: string }> =
  Object.fromEntries(
    DEFAULT_SOURCE_CONFIG.map((e) => [e.key, { label: e.label, color: e.color, bg: e.bg }]),
  ) as Record<LeadSource, { label: string; color: string; bg: string }>

export default function SourceBadge({ source }: { source: LeadSource }) {
  const entry = useSourceEntry(source)
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
