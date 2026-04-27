import type { SourceConfig } from '@/types'

export const DEFAULT_SOURCE_CONFIG: SourceConfig = [
  { key: 'manuel',        label: 'Manuel',        color: '#a0a0a0', bg: 'rgba(160,160,160,0.10)', visible: true },
  { key: 'facebook_ads',  label: 'Facebook Ads',  color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  visible: true },
  { key: 'instagram_ads', label: 'Instagram Ads', color: '#e879f9', bg: 'rgba(232,121,249,0.10)', visible: true },
  { key: 'follow_ads',    label: 'Follow Ads',    color: '#a855f7', bg: 'rgba(168,85,247,0.10)',  visible: true },
  { key: 'formulaire',    label: 'Formulaire',    color: '#06b6d4', bg: 'rgba(6,182,212,0.10)',   visible: true },
  { key: 'funnel',        label: 'Funnel',        color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  visible: true },
]
