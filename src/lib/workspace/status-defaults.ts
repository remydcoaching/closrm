import type { StatusConfig } from '@/types'

export const DEFAULT_STATUS_CONFIG: StatusConfig = [
  { key: 'nouveau',          label: 'Nouveau',          color: '#a0a0a0',              bg: 'rgba(160,160,160,0.12)', visible: true },
  { key: 'scripte',          label: 'Scripté',          color: '#06b6d4',              bg: 'rgba(6,182,212,0.12)',   visible: true },
  { key: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6',              bg: 'rgba(59,130,246,0.12)',  visible: true },
  { key: 'no_show_setting',  label: 'No-show Setting',  color: '#f59e0b',              bg: 'rgba(245,158,11,0.12)',  visible: true },
  { key: 'closing_planifie', label: 'Closing planifié', color: '#a855f7',              bg: 'rgba(168,85,247,0.12)',  visible: true },
  { key: 'no_show_closing',  label: 'No-show Closing',  color: '#f97316',              bg: 'rgba(249,115,22,0.12)',  visible: true },
  { key: 'clos',             label: 'Closé ✅',         color: 'var(--color-primary)', bg: 'rgba(0,200,83,0.12)',    visible: true },
  { key: 'dead',             label: 'Dead ❌',          color: '#ef4444',              bg: 'rgba(239,68,68,0.12)',   visible: true },
]
