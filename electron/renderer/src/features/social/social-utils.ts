// Pure helpers ported from the web (src/lib/social/intent-classifier.ts,
// src/lib/instagram/shortcode.ts, components/social/planning/slot-stepper.ts,
// BoardView/PlanModal/TrameEditorModal date + grid helpers). Same logic, so
// desktop and web classify / group / validate identically.
import type { SocialPost, SocialProductionStatus, TrameGrid, Weekday } from './types'

// ─── Intent classifier ──────────────────────────────────────────────────────
export type SocialIntent = 'rdv' | 'prix' | 'info' | 'objection' | 'fan' | 'spam' | 'neutre'

export const INTENT_META: Record<SocialIntent, { label: string; color: string; priority: number; description: string }> = {
  rdv: { label: 'RDV', color: '#10b981', priority: 5, description: 'Demande un appel / créneau' },
  prix: { label: 'Prix', color: '#f59e0b', priority: 4, description: 'Demande tarifaire' },
  info: { label: 'Info', color: '#3b82f6', priority: 3, description: 'Demande d’infos sur le programme' },
  objection: { label: 'Objection', color: '#a855f7', priority: 3, description: 'Frein / question' },
  fan: { label: 'Fan', color: '#ec4899', priority: 1, description: 'Compliment / soutien' },
  spam: { label: 'Spam', color: '#64748b', priority: 0, description: 'Emoji seul / inutile' },
  neutre: { label: '—', color: '#94a3b8', priority: 2, description: 'Autre' },
}

const RX_RDV = /\b(rdv|rendez[\s-]?vous|cr[ée]neau|cr[ée]neaux|disponib|dispo|appel(e|er|ons)?|call|booker|r[ée]server|on s'?appelle|tu peux m'?appeler)\b/i
const RX_PRIX = /\b(prix|tarif|tarifs|co[ûu]te|combien|c[\s']?est combien|payant|abonnement|mensualit[ée]|le co[ûu]t|budget|gratuit ou)\b/i
const RX_INFO = /\b(info|infos|info(rmation)?s?|renseignement|d[ée]tails?|en savoir|comment[\s]?[çc]a|comment fonctionne|comment marche|programme|coaching|accompagnement|m[ée]thode|formation|j['']aimerais en savoir|peux[\s-]tu m['']en dire)\b/i
const RX_OBJECTION = /\b(mais|trop cher|peur|pas s[ûu]r|s[ée]rieux|arnaque|garantie|rembours|fonctionne vraiment|[çc]a marche vraiment|sceptique|h[ée]site)\b/i
const RX_FAN = /\b(top|g[ée]nial|incroyable|merci|bravo|inspirant|inspir[ée]e|j['']adore|love|magnifique|continue|f[ée]licitation)\b/i
const RX_EMOJI_ONLY = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}!?.]+$/u
const RX_GENERIC_SPAM = /^(first|premier|🔥+|❤️+|👏+|👍+|nice|cool|wow)$/i

export function classifyIntent(raw: string | null | undefined): SocialIntent {
  if (!raw) return 'neutre'
  const text = raw.trim()
  if (text.length === 0) return 'spam'
  if (RX_EMOJI_ONLY.test(text) || RX_GENERIC_SPAM.test(text)) return 'spam'
  if (RX_RDV.test(text)) return 'rdv'
  if (RX_PRIX.test(text)) return 'prix'
  if (RX_INFO.test(text)) return 'info'
  if (RX_OBJECTION.test(text)) return 'objection'
  if (RX_FAN.test(text)) return 'fan'
  return 'neutre'
}

export function intentSortValue(i: SocialIntent): number {
  return INTENT_META[i].priority
}

// ─── Instagram shortcode ────────────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function mediaIdToShortcode(mediaId: string): string {
  if (!mediaId) return ''
  const numeric = mediaId.split('_')[0]
  if (!/^\d+$/.test(numeric)) return mediaId
  let n: bigint
  try {
    n = BigInt(numeric)
  } catch {
    return mediaId
  }
  let out = ''
  while (n > BigInt(0)) {
    out = ALPHABET[Number(n & BigInt(63))] + out
    n = n >> BigInt(6)
  }
  return out || mediaId
}

export function reelUrl(mediaId: string): string | null {
  const sc = mediaIdToShortcode(mediaId)
  return sc ? `https://www.instagram.com/reel/${sc}/` : null
}

// ─── Formatting ─────────────────────────────────────────────────────────────
/** Compact figure ("12,3K") — same as the web's atoms.fmt(). */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return Math.round(n).toString()
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function timeAgo(dateStr: string | null, now = Date.now()): string {
  if (!dateStr) return ''
  const diff = now - new Date(dateStr).getTime()
  if (diff < 0) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── Planning: production statuses + stepper ────────────────────────────────
export const PRODUCTION_STATUSES: { value: SocialProductionStatus; label: string; color: string }[] = [
  { value: 'idea', label: 'Idée', color: '#94a3b8' },
  { value: 'to_film', label: 'À filmer', color: '#f59e0b' },
  { value: 'filmed', label: 'À monter', color: '#06b6d4' },
  { value: 'edited', label: 'Monté', color: '#8b5cf6' },
  { value: 'ready', label: 'Prêt', color: '#10b981' },
]

export type StepKey = 'brief' | 'montage' | 'publication'

export function getDefaultStep(slot: SocialPost): StepKey {
  if (slot.status === 'scheduled' || slot.status === 'published' || slot.status === 'publishing') return 'publication'
  switch (slot.production_status) {
    case 'filmed':
    case 'edited':
      return 'montage'
    case 'ready':
      return 'publication'
    default:
      return 'brief'
  }
}

export function isStepComplete(slot: SocialPost, step: StepKey): boolean {
  if (step === 'brief') {
    const hookOk = !!slot.hook && slot.hook.trim().length > 0
    const scriptOk = !!slot.script && slot.script.trim().length > 0
    const refsOk = Array.isArray(slot.references_urls) && slot.references_urls.length > 0
    return hookOk && (scriptOk || refsOk)
  }
  if (step === 'montage') return !!slot.final_url && slot.final_url.trim().length > 0
  return (slot.publications ?? []).length > 0 && Array.isArray(slot.media_urls) && slot.media_urls.length > 0
}

export function getTransitionAction(slot: SocialPost, step: StepKey): { label: string; nextStatus: 'filmed' | 'ready' } | null {
  if (step === 'brief' && (slot.production_status === 'idea' || slot.production_status === 'to_film')) {
    return { label: 'Envoyer au montage', nextStatus: 'filmed' }
  }
  if (step === 'montage' && !!slot.final_url && slot.final_url.trim().length > 0 && slot.production_status !== 'ready') {
    return { label: 'Valider le montage', nextStatus: 'ready' }
  }
  return null
}

// ─── Planning: periods / weeks / month grid ─────────────────────────────────
export type BoardPeriod = 'this_week' | 'this_month' | 'next_month' | 'all'

export function periodRange(period: BoardPeriod, now = new Date()): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null }
  if (period === 'this_week') {
    const dow = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - dow)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { from: isoDay(monday), to: isoDay(sunday) }
  }
  if (period === 'this_month') {
    return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
  }
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 1)), to: isoDay(new Date(now.getFullYear(), now.getMonth() + 2, 0)) }
}

export type PlanPreset = 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'custom'

export function planPresetRange(preset: PlanPreset, today = new Date()): { start: string; end: string } {
  if (preset === 'this_week') {
    const r = periodRange('this_week', today)
    return { start: r.from ?? isoDay(today), end: r.to ?? isoDay(today) }
  }
  if (preset === 'next_week') {
    const end = new Date(today)
    end.setDate(today.getDate() + 6)
    return { start: isoDay(today), end: isoDay(end) }
  }
  if (preset === 'this_month' || preset === 'next_month') {
    const r = periodRange(preset, today)
    return { start: r.from ?? isoDay(today), end: r.to ?? isoDay(today) }
  }
  const end = new Date(today)
  end.setDate(today.getDate() + 13)
  return { start: isoDay(today), end: isoDay(end) }
}

/** Monday (YYYY-MM-DD) of the week containing `dateIso`. */
export function weekKey(dateIso: string): string {
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00`)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return isoDay(d)
}

/** 42-cell Monday-first month grid (same as PlanningCalendarView). */
export function monthCells(year: number, month: number): { key: string; day: number; inMonth: boolean; weekend: boolean }[] {
  const first = new Date(year, month - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const out: { key: string; day: number; inMonth: boolean; weekend: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month - 1, 1 - startOffset + i)
    out.push({ key: isoDay(d), day: d.getDate(), inMonth: d.getMonth() === month - 1, weekend: d.getDay() === 0 || d.getDay() === 6 })
  }
  return out
}

/** Window fetched for the planning (current month + next month), like buildPostsUrl(). */
export function planningWindow(year: number, month: number): { from: string; to: string } {
  return { from: isoDay(new Date(year, month - 1, 1)), to: isoDay(new Date(year, month + 1, 0)) }
}

// ─── Trame grids ────────────────────────────────────────────────────────────
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

export function normalizeGrid(grid: Partial<TrameGrid> | undefined, perDay: number): TrameGrid {
  const out = {} as TrameGrid
  for (const wd of WEEKDAYS) {
    const arr = (grid?.[wd] ?? []).slice(0, perDay)
    while (arr.length < perDay) arr.push(null)
    out[wd] = arr
  }
  return out
}

export function replaceInGrid(grid: TrameGrid, from: string, to: string | null): TrameGrid {
  const out = {} as TrameGrid
  for (const wd of WEEKDAYS) out[wd] = (grid[wd] ?? []).map((c) => (c === from ? to : c))
  return out
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
