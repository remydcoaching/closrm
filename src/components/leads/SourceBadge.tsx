import { LeadSource } from '@/types'

const SOURCE_CONFIG: Record<LeadSource, { label: string; color: string; bg: string }> = {
  facebook_ads: { label: 'Facebook Ads', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  instagram_ads: { label: 'Instagram Ads', color: '#e879f9', bg: 'rgba(232,121,249,0.10)' },
  formulaire: { label: 'Formulaire', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)' },
  manuel: { label: 'Manuel', color: '#a0a0a0', bg: 'rgba(160,160,160,0.10)' },
  funnel: { label: 'Funnel', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
}

export default function SourceBadge({ source }: { source: LeadSource }) {
  const config = SOURCE_CONFIG[source]
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
