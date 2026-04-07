'use client'

import type { CampaignType } from './health-thresholds'

export type CampaignTypeFilter = CampaignType | 'all'

interface AdsCampaignTypeToggleProps {
  value: CampaignTypeFilter
  onChange: (value: CampaignTypeFilter) => void
}

const OPTIONS: { value: CampaignTypeFilter; label: string }[] = [
  { value: 'leadform', label: 'Leadform' },
  { value: 'follow_ads', label: 'Follow Ads' },
  { value: 'all', label: 'Tout' },
]

export default function AdsCampaignTypeToggle({ value, onChange }: AdsCampaignTypeToggleProps) {
  return (
    <div style={{
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border-primary)',
    }}>
      {OPTIONS.map((opt, idx) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '7px 16px',
            fontSize: 12,
            fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            background: value === opt.value ? '#1877F2' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            borderRight: idx < OPTIONS.length - 1 ? '1px solid var(--border-primary)' : 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
