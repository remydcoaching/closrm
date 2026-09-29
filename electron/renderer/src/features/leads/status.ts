// Mirrors src/lib/workspace/status-defaults.ts and source-defaults.ts from
// the main ClosRM repo. ClosRM workspaces can customize these labels/colors
// (workspace_config, see useStatusConfig() on web) — Electron does not yet
// consume that per-workspace override (no endpoint wired for it in M3-B), so
// this uses the same DEFAULT config the web ships with. Not a new status
// system: same 9 statuses, same 6 sources, same meaning.
import type { LeadStatus, LeadSource } from './types'

export interface StatusEntry {
  key: LeadStatus
  label: string
  color: string
  bg: string
}

export interface SourceEntry {
  key: LeadSource
  label: string
  color: string
  bg: string
}

export const STATUS_CONFIG: StatusEntry[] = [
  { key: 'nouveau', label: 'Nouveau', color: '#8a8e96', bg: 'rgba(138,142,150,0.12)' },
  { key: 'scripte', label: 'Scripté', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { key: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { key: 'no_show_setting', label: 'No-show Setting', color: '#d9820b', bg: 'rgba(217,130,11,0.12)' },
  { key: 'closing_planifie', label: 'Closing planifié', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  { key: 'no_show_closing', label: 'No-show Closing', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'clos', label: 'Closé ✅', color: '#1a7f4e', bg: 'rgba(26,127,78,0.12)' },
  { key: 'pas_qualifie', label: 'Pas qualifié', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  { key: 'dead', label: 'Dead ❌', color: '#d63447', bg: 'rgba(214,52,71,0.12)' },
]

export const SOURCE_CONFIG: SourceEntry[] = [
  { key: 'manuel', label: 'Manuel', color: '#8a8e96', bg: 'rgba(138,142,150,0.10)' },
  { key: 'facebook_ads', label: 'Facebook Ads', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  { key: 'instagram_ads', label: 'Instagram Ads', color: '#e879f9', bg: 'rgba(232,121,249,0.10)' },
  { key: 'follow_ads', label: 'Follow Ads', color: '#a855f7', bg: 'rgba(168,85,247,0.10)' },
  { key: 'formulaire', label: 'Formulaire', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)' },
  { key: 'funnel', label: 'Funnel', color: '#d9820b', bg: 'rgba(217,130,11,0.10)' },
]

const STATUS_MAP = new Map(STATUS_CONFIG.map((s) => [s.key, s]))
const SOURCE_MAP = new Map(SOURCE_CONFIG.map((s) => [s.key, s]))

export function statusEntry(status: LeadStatus): StatusEntry {
  return STATUS_MAP.get(status) ?? { key: status, label: status, color: '#8a8e96', bg: 'rgba(138,142,150,0.12)' }
}

export function sourceEntry(source: LeadSource): SourceEntry {
  return SOURCE_MAP.get(source) ?? { key: source, label: source, color: '#8a8e96', bg: 'rgba(138,142,150,0.10)' }
}

export function displayName(first: string, last: string, fallback: string): string {
  const name = `${first} ${last}`.trim()
  return name || fallback
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const CALL_OUTCOME_LABELS: Record<string, string> = {
  pending: 'En attente',
  done: 'Fait',
  cancelled: 'Annulé',
  no_show: 'Absent',
}

export function callOutcomeLabel(outcome: string): string {
  return CALL_OUTCOME_LABELS[outcome] ?? outcome
}

const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  fait: 'Fait',
  annule: 'Annulé',
}

export function followUpStatusLabel(status: string): string {
  return FOLLOW_UP_STATUS_LABELS[status] ?? status
}

const FOLLOW_UP_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  instagram_dm: 'Instagram DM',
  manuel: 'Manuel',
}

export function followUpChannelLabel(channel: string): string {
  return FOLLOW_UP_CHANNEL_LABELS[channel] ?? channel
}

const CALL_TYPE_LABELS: Record<string, string> = {
  setting: 'Setting',
  closing: 'Closing',
}

export function callTypeLabel(type: string): string {
  return CALL_TYPE_LABELS[type] ?? type
}

/**
 * Next pending follow-up for a lead, derived client-side from data already
 * fetched via GET /api/leads/:id (follow_ups[]) — not a new backend field.
 * Mirrors what a coach would scan for manually: earliest `en_attente`
 * follow-up in the future, or the most overdue one if all are in the past.
 */
export function nextFollowUp<T extends { status: string; scheduled_at: string }>(followUps: T[]): T | null {
  const pending = followUps.filter((f) => f.status === 'en_attente')
  if (pending.length === 0) return null
  return [...pending].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
}

/** "17 sept." — the short date used in every table's date column. */
export function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}
