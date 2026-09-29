// Column catalogue, default views and per-row value computation — same
// columns, labels, info texts, formulas and saved-view presets as the web's
// ads-table-tab.tsx. Views + column order persist in localStorage with the
// same keys as the web (`ads-cols-v2-<tab>`, `ads-views-<tab>`).
import type { AdPerformanceRow, MetaBreakdownRow } from './types'
import { euro, num } from './metrics'

export type ColumnKey =
  | 'name' | 'status' | 'spend' | 'impressions' | 'cpm' | 'clicks' | 'cpc' | 'ctr' | 'leads' | 'cpl' | 'frequency'
  | 'hook_rate' | 'hold_rate_25' | 'hold_rate_50' | 'hold_rate_75'
  | 'crm_leads' | 'qualified' | 'calls_total' | 'calls_reached' | 'cpar' | 'joignabilite'
  | 'cr1' | 'cr2' | 'cr3'
  | 'bookings_total' | 'cpsb' | 'bookings_show_up' | 'cpsp' | 'no_show_rate'
  | 'closed' | 'cpclose' | 'closing_rate'
  | 'revenue' | 'cash_collected' | 'cpl_qualified' | 'roas' | 'marge_brute'

export type SortKey = Exclude<ColumnKey, 'status'>

export interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  align: 'left' | 'right'
  defaultVisible: boolean
  infoText: string
}

export interface SavedView {
  id: string
  name: string
  columns: ColumnKey[]
}

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Nom', sortable: true, align: 'left', defaultVisible: true, infoText: 'Nom de la campagne / adset / publicité.' },
  { key: 'status', label: 'Statut', sortable: false, align: 'left', defaultVisible: true, infoText: 'État Meta : Actif, Pausé, Refusé…' },
  { key: 'spend', label: 'Dépensé', sortable: true, align: 'right', defaultVisible: true, infoText: 'Budget consommé sur la période (€).' },
  { key: 'impressions', label: 'Impressions', sortable: true, align: 'right', defaultVisible: false, infoText: 'Nombre de fois où ta pub a été affichée.' },
  { key: 'cpm', label: 'CPM', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût pour 1 000 impressions = (Dépense / Impressions) × 1 000.' },
  { key: 'clicks', label: 'Clics', sortable: true, align: 'right', defaultVisible: false, infoText: 'Clics sur la pub (tous types : lien, profil, etc.).' },
  { key: 'cpc', label: 'CPC', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par clic = Dépense / Clics.' },
  { key: 'ctr', label: 'CTR', sortable: true, align: 'right', defaultVisible: false, infoText: "Taux de clic = (Clics / Impressions) × 100. Plus c'est haut, plus ta créa accroche." },
  { key: 'leads', label: 'Leads Meta', sortable: true, align: 'right', defaultVisible: false, infoText: 'Leads remontés par Meta (formulaires soumis). Peut différer des Leads CRM si des dédoublons sont faits dans ClosRM.' },
  { key: 'cpl', label: 'CPL Meta', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par lead côté Meta = Dépense / Leads Meta.' },
  { key: 'frequency', label: 'Répétition', sortable: true, align: 'right', defaultVisible: false, infoText: "Nombre de fois moyen où un utilisateur a vu ta pub. Au-delà de 3-4, l'audience sature." },
  { key: 'hook_rate', label: 'Hook rate', sortable: true, align: 'right', defaultVisible: false, infoText: "Lectures vidéo / Impressions. % de gens qui s'arrêtent au moins 3 sec. Mesure si ton hook accroche." },
  { key: 'hold_rate_25', label: 'Hold 25%', sortable: true, align: 'right', defaultVisible: false, infoText: '% de spectateurs qui regardent au moins 25 % de la vidéo.' },
  { key: 'hold_rate_50', label: 'Hold 50%', sortable: true, align: 'right', defaultVisible: false, infoText: '% de spectateurs qui regardent au moins 50 % de la vidéo.' },
  { key: 'hold_rate_75', label: 'Hold 75%', sortable: true, align: 'right', defaultVisible: false, infoText: '% de spectateurs qui regardent au moins 75 % de la vidéo.' },
  { key: 'crm_leads', label: 'Leads CRM', sortable: true, align: 'right', defaultVisible: true, infoText: 'Leads réellement présents dans ton CRM ClosRM (déduplication incluse).' },
  { key: 'qualified', label: 'Qualifiés', sortable: true, align: 'right', defaultVisible: true, infoText: 'Leads dont le statut est passé à Setting planifié, Closing planifié ou Closé.' },
  { key: 'calls_total', label: 'Appels passés', sortable: true, align: 'right', defaultVisible: false, infoText: "Nombre total de tentatives d'appels (call_attempts)." },
  { key: 'calls_reached', label: 'Appels joints', sortable: true, align: 'right', defaultVisible: false, infoText: 'Appels où tu as eu le prospect au bout du fil (reached = true).' },
  { key: 'cpar', label: 'CPAr', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par appel répondu = Dépense / Appels joints.' },
  { key: 'joignabilite', label: '% Joignabilité', sortable: true, align: 'right', defaultVisible: false, infoText: 'Appels joints / Appels passés × 100. % de leads que tu arrives à joindre.' },
  { key: 'cr1', label: 'CR1', sortable: true, align: 'right', defaultVisible: false, infoText: 'Conversion 1 : Leads / Clics × 100. % de clics qui deviennent un lead (formulaire rempli).' },
  { key: 'cr2', label: 'CR2', sortable: true, align: 'right', defaultVisible: false, infoText: 'Conversion 2 : Appels joints / Leads × 100. % de leads que tu arrives à joindre au téléphone.' },
  { key: 'cr3', label: 'CR3', sortable: true, align: 'right', defaultVisible: false, infoText: "Conversion 3 : Séances bookées / Appels joints × 100. % d'appels joints qui prennent un RDV." },
  { key: 'bookings_total', label: 'Séances bookées', sortable: true, align: 'right', defaultVisible: false, infoText: 'Nombre de RDV pris (tous statuts confondus).' },
  { key: 'cpsb', label: 'CPSb', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par séance bookée = Dépense / Séances bookées.' },
  { key: 'bookings_show_up', label: 'Séances présentes', sortable: true, align: 'right', defaultVisible: false, infoText: 'RDV où le prospect est venu (présent, complété).' },
  { key: 'cpsp', label: 'CPSp', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par séance présente = Dépense / Séances présentes.' },
  { key: 'no_show_rate', label: '% No show', sortable: true, align: 'right', defaultVisible: false, infoText: "% de RDV où personne ne s'est présenté = (Séances bookées − Séances présentes) / Séances bookées × 100." },
  { key: 'closed', label: 'Closings', sortable: true, align: 'right', defaultVisible: true, infoText: 'Leads dont le statut est passé à Closé (vente conclue).' },
  { key: 'cpclose', label: 'CPClose', sortable: true, align: 'right', defaultVisible: false, infoText: 'Coût par vente = Dépense / Closings.' },
  { key: 'closing_rate', label: '% Closing', sortable: true, align: 'right', defaultVisible: false, infoText: 'Taux de closing = Closings / Séances présentes × 100. % de RDV qui débouchent sur une vente.' },
  { key: 'revenue', label: 'CA contracté', sortable: true, align: 'right', defaultVisible: true, infoText: "Chiffre d'affaires total contracté (somme des deal_amount des leads closés)." },
  { key: 'cash_collected', label: 'Cash collecté', sortable: true, align: 'right', defaultVisible: false, infoText: 'Argent réellement encaissé (somme des cash_collected des leads closés). Différent du CA si paiements en plusieurs fois.' },
  { key: 'cpl_qualified', label: 'CPL qualifié', sortable: true, align: 'right', defaultVisible: false, infoText: "Coût par lead qualifié = Dépense / Qualifiés. C'est LA métrique que ton coach pub te dit de regarder." },
  { key: 'roas', label: 'ROAS', sortable: true, align: 'right', defaultVisible: true, infoText: "Return on Ad Spend = CA contracté / Dépense. ROAS > 3 = c'est rentable." },
  { key: 'marge_brute', label: 'Marge brute', sortable: true, align: 'right', defaultVisible: false, infoText: 'CA contracté − Dépense. Combien tu gardes après avoir payé tes pubs (avant les autres charges).' },
]

export const ALL_COLUMN_KEYS: ColumnKey[] = ALL_COLUMNS.map((c) => c.key)
export const COLUMN_MAP = new Map(ALL_COLUMNS.map((c) => [c.key, c]))
export const DEFAULT_COLUMNS: ColumnKey[] = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)

export const DEFAULT_VIEWS: SavedView[] = [
  { id: 'simple', name: 'Simple', columns: ['name', 'status', 'spend', 'crm_leads', 'closed', 'revenue', 'roas'] },
  {
    id: 'performance',
    name: 'Performance',
    columns: ['name', 'status', 'spend', 'crm_leads', 'calls_total', 'calls_reached', 'joignabilite', 'cr1', 'bookings_total', 'cr2', 'bookings_show_up', 'no_show_rate', 'cr3', 'closed', 'closing_rate'],
  },
  {
    id: 'business',
    name: 'Business',
    columns: ['name', 'status', 'spend', 'crm_leads', 'qualified', 'closed', 'revenue', 'cash_collected', 'marge_brute', 'roas', 'cpl_qualified', 'cpclose'],
  },
  {
    id: 'complete',
    name: 'Complète',
    columns: [
      'name', 'status', 'spend',
      'impressions', 'cpm', 'clicks', 'cpc', 'ctr',
      'leads', 'cpl', 'crm_leads',
      'cr1', 'calls_total', 'calls_reached', 'cpar', 'joignabilite', 'cr2',
      'bookings_total', 'cpsb', 'cr3', 'bookings_show_up', 'cpsp', 'no_show_rate',
      'closed', 'cpclose', 'closing_rate',
      'hook_rate', 'hold_rate_50',
      'qualified', 'cpl_qualified', 'cash_collected', 'revenue', 'marge_brute', 'roas',
    ],
  },
]

/** Keeps only known keys, in order, and always includes 'name'. */
export function sanitizeColumns(cols: unknown): ColumnKey[] | null {
  if (!Array.isArray(cols)) return null
  const valid = cols.filter((k): k is ColumnKey => typeof k === 'string' && (ALL_COLUMN_KEYS as string[]).includes(k))
  if (valid.length === 0) return null
  return valid.includes('name') ? valid : ['name', ...valid]
}

export function moveColumn(cols: ColumnKey[], key: ColumnKey, targetIndex: number): ColumnKey[] {
  const from = cols.indexOf(key)
  if (from < 0) return cols
  const next = cols.filter((k) => k !== key)
  const idx = Math.max(0, Math.min(targetIndex, next.length))
  next.splice(idx, 0, key)
  return next
}

/**
 * Numeric (or string for 'name') value for a column — identical formulas to
 * the web's computeValue(). Returns null when the ratio is undefined
 * (denominator 0 or CRM row missing), so health coloring and "—" rendering
 * stay honest.
 */
export function columnValue(row: MetaBreakdownRow, crm: AdPerformanceRow | undefined, key: SortKey): number | string | null {
  const spend = row.spend || 0
  switch (key) {
    case 'name': return row.name
    case 'spend': return spend
    case 'impressions': return row.impressions
    case 'clicks': return row.clicks
    case 'ctr': return row.ctr
    case 'leads': return row.leads
    case 'cpl': return row.cpl
    case 'cpm': return row.impressions > 0 ? (spend / row.impressions) * 1000 : null
    case 'cpc': return row.clicks > 0 ? spend / row.clicks : null
    case 'frequency': return row.frequency ?? null
    case 'hook_rate': return row.hook_rate ?? null
    case 'hold_rate_25': return row.hold_rate_25 ?? null
    case 'hold_rate_50': return row.hold_rate_50 ?? null
    case 'hold_rate_75': return row.hold_rate_75 ?? null
  }
  if (!crm) {
    return key === 'marge_brute' ? null : ['crm_leads', 'qualified', 'calls_total', 'calls_reached', 'bookings_total', 'bookings_show_up', 'closed'].includes(key) ? 0 : null
  }
  switch (key) {
    case 'crm_leads': return crm.lead_count
    case 'qualified': return crm.qualified_count
    case 'calls_total': return crm.calls_count
    case 'calls_reached': return crm.calls_reached
    case 'cpar': return crm.calls_reached > 0 ? spend / crm.calls_reached : null
    case 'joignabilite': return crm.calls_count > 0 ? (crm.calls_reached / crm.calls_count) * 100 : null
    case 'cr1': return row.clicks > 0 ? (crm.lead_count / row.clicks) * 100 : null
    case 'cr2': return crm.lead_count > 0 ? (crm.calls_reached / crm.lead_count) * 100 : null
    case 'cr3': return crm.calls_reached > 0 ? (crm.bookings_total / crm.calls_reached) * 100 : null
    case 'bookings_total': return crm.bookings_total
    case 'cpsb': return crm.bookings_total > 0 ? spend / crm.bookings_total : null
    case 'bookings_show_up': return crm.bookings_show_up
    case 'cpsp': return crm.bookings_show_up > 0 ? spend / crm.bookings_show_up : null
    case 'no_show_rate': return crm.bookings_total > 0 ? ((crm.bookings_total - crm.bookings_show_up) / crm.bookings_total) * 100 : null
    case 'closed': return crm.closed_count
    case 'cpclose': return crm.closed_count > 0 ? spend / crm.closed_count : null
    case 'closing_rate': return crm.bookings_show_up > 0 ? (crm.closed_count / crm.bookings_show_up) * 100 : null
    case 'revenue': return crm.revenue
    case 'cash_collected': return crm.cash_collected
    case 'cpl_qualified': return crm.cpl_qualified
    case 'roas': return crm.roas
    case 'marge_brute': return crm.revenue - spend
  }
}

const EURO_KEYS = new Set<ColumnKey>(['spend', 'cpm', 'cpc', 'cpl', 'cpar', 'cpsb', 'cpsp', 'cpclose', 'revenue', 'cash_collected', 'cpl_qualified', 'marge_brute'])
const PCT1_KEYS = new Set<ColumnKey>(['hook_rate', 'hold_rate_25', 'hold_rate_50', 'hold_rate_75', 'cr1'])
const PCT0_KEYS = new Set<ColumnKey>(['joignabilite', 'cr2', 'cr3', 'no_show_rate', 'closing_rate'])

/** Text for a numeric cell — same precision choices as the web table. */
export function formatColumnValue(key: ColumnKey, value: number | string | null): string {
  if (value === null) return '—'
  if (typeof value === 'string') return value
  if (key === 'revenue' || key === 'cash_collected') return value ? euro(value, 2) : '—'
  if (EURO_KEYS.has(key)) return euro(value, 2)
  if (key === 'ctr') return `${value.toFixed(2)} %`
  if (PCT1_KEYS.has(key)) return `${value.toFixed(1)} %`
  if (PCT0_KEYS.has(key)) return `${value.toFixed(0)} %`
  if (key === 'frequency') return value.toFixed(2)
  if (key === 'roas') return `${value.toFixed(2).replace('.', ',')}x`
  return num(value)
}

export function metaStatus(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Actif', color: 'var(--color-success)', bg: 'var(--color-success-soft)' }
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Pausé', color: 'var(--color-text-muted)', bg: 'var(--color-bg-muted)' }
    case 'DELETED':
    case 'ARCHIVED':
      return { label: 'Archivé', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' }
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PENDING_BILLING_INFO':
      return { label: 'En cours', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' }
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
      return { label: 'Problème', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' }
    case 'UNATTRIBUTED':
      return { label: 'Non attribué', color: 'var(--color-text-muted)', bg: 'var(--color-bg-muted)' }
    default:
      return { label: 'Brouillon', color: 'var(--color-text-muted)', bg: 'var(--color-bg-muted)' }
  }
}
