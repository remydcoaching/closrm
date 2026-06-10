import type { LeadStatus, LeadSource } from '@shared/types'

export const statusConfig: Record<
  LeadStatus,
  { label: string; color: string; bg: string }
> = {
  nouveau: { label: 'Nouveau', color: '#a1a1aa', bg: '#27272a' },
  scripte: { label: 'Scripté', color: '#06b6d4', bg: '#164e63' },
  setting_planifie: { label: 'Setting planifié', color: '#3b82f6', bg: '#1e3a5f' },
  no_show_setting: { label: 'No-show Setting', color: '#f59e0b', bg: '#78350f' },
  closing_planifie: { label: 'Closing planifié', color: '#a855f7', bg: '#581c87' },
  no_show_closing: { label: 'No-show Closing', color: '#f97316', bg: '#7c2d12' },
  clos: { label: 'Closé', color: '#00C853', bg: '#14532d' },
  dead: { label: 'Dead', color: '#ef4444', bg: '#7f1d1d' },
}

export const sourceConfig: Record<
  LeadSource,
  { label: string; color: string; bg: string }
> = {
  manuel: { label: 'Manuel', color: '#a1a1aa', bg: '#27272a' },
  facebook_ads: { label: 'Facebook Ads', color: '#3b82f6', bg: '#1e3a5f' },
  instagram_ads: { label: 'Instagram Ads', color: '#ec4899', bg: '#831843' },
  follow_ads: { label: 'Follow Ads', color: '#a855f7', bg: '#581c87' },
  formulaire: { label: 'Formulaire', color: '#06b6d4', bg: '#164e63' },
  funnel: { label: 'Funnel', color: '#f97316', bg: '#7c2d12' },
}
