// Pure helpers for the Publicités page: period → date range (same algorithm
// as getDefaultDateRange() in src/app/api/meta/insights/route.ts), number
// formatting, and CRM aggregation (from /api/meta/ad-performance rows).
import type { AdPerformanceRow, CampaignType, MetaBreakdownRow } from './types'

export type PeriodPreset = 'today' | '7d' | '14d' | '30d' | '90d' | 'custom'

export const PERIOD_ITEMS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d', label: '7 j' },
  { key: '14d', label: '14 j' },
  { key: '30d', label: '30 j' },
  { key: '90d', label: '90 j' },
  { key: 'custom', label: 'Personnalisé' },
]

const PRESET_DAYS: Record<Exclude<PeriodPreset, 'custom'>, number> = { today: 0, '7d': 7, '14d': 14, '30d': 30, '90d': 90 }

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Mirrors the server: `to` = today (UTC ISO day), `from` = today − N days. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now: Date = new Date()): { dateFrom: string; dateTo: string } {
  const dateTo = isoDay(now)
  const days = PRESET_DAYS[preset]
  if (days === 0) return { dateFrom: dateTo, dateTo }
  const from = new Date(now.getTime())
  from.setDate(from.getDate() - days)
  return { dateFrom: isoDay(from), dateTo }
}

/** Same-length window ending the day before `dateFrom` (as /api/performance/follow-ads does). */
export function previousRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const duration = to.getTime() - from.getTime()
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - duration)
  return { dateFrom: isoDay(prevFrom), dateTo: isoDay(prevTo) }
}

export function euro(n: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function num(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function pct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals).replace('.', ',')} %`
}

/** % change vs previous; null when there is no meaningful base. */
export function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function safeDiv(a: number, b: number): number | null {
  return b > 0 ? a / b : null
}

export interface CrmTotals {
  lead_count: number
  qualified_count: number
  closed_count: number
  calls_count: number
  calls_reached: number
  bookings_total: number
  bookings_show_up: number
  revenue: number
  cash_collected: number
}

export const EMPTY_CRM: CrmTotals = {
  lead_count: 0,
  qualified_count: 0,
  closed_count: 0,
  calls_count: 0,
  calls_reached: 0,
  bookings_total: 0,
  bookings_show_up: 0,
  revenue: 0,
  cash_collected: 0,
}

export function sumCrm(rows: AdPerformanceRow[]): CrmTotals {
  const t: CrmTotals = { ...EMPTY_CRM }
  for (const r of rows) {
    t.lead_count += r.lead_count
    t.qualified_count += r.qualified_count
    t.closed_count += r.closed_count
    t.calls_count += r.calls_count
    t.calls_reached += r.calls_reached
    t.bookings_total += r.bookings_total
    t.bookings_show_up += r.bookings_show_up
    t.revenue += r.revenue
    t.cash_collected += r.cash_collected
  }
  return t
}

export type CrmBucket = CampaignType | 'unattributed'

/**
 * Splits campaign-level CRM rows by campaign type, using the campaign-level
 * Meta breakdown (which carries campaign_type). The ad-performance route's
 * "__unattributed__" bucket (and campaigns Meta no longer lists) go to
 * 'unattributed' / 'other' respectively.
 */
export function crmByCampaignType(crmRows: AdPerformanceRow[], campaigns: MetaBreakdownRow[]): Record<CrmBucket, CrmTotals> {
  const typeById = new Map(campaigns.map((c) => [c.id, c.campaign_type]))
  const groups: Record<CrmBucket, AdPerformanceRow[]> = { leadform: [], follow_ads: [], other: [], unattributed: [] }
  for (const r of crmRows) {
    if (r.id === '__unattributed__') groups.unattributed.push(r)
    else groups[typeById.get(r.id) ?? 'other'].push(r)
  }
  return {
    leadform: sumCrm(groups.leadform),
    follow_ads: sumCrm(groups.follow_ads),
    other: sumCrm(groups.other),
    unattributed: sumCrm(groups.unattributed),
  }
}

export function addCrm(a: CrmTotals, b: CrmTotals): CrmTotals {
  const out: CrmTotals = { ...EMPTY_CRM }
  for (const k of Object.keys(out) as (keyof CrmTotals)[]) out[k] = a[k] + b[k]
  return out
}
