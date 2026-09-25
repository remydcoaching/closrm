import { describe, expect, it } from 'vitest'
import { evaluateHealthColor, effectiveThreshold } from '../health-thresholds'
import { crmByCampaignType, deltaPct, presetRange, previousRange, sumCrm } from '../metrics'
import { columnValue, formatColumnValue, moveColumn, sanitizeColumns } from '../columns'
import type { AdPerformanceRow, MetaBreakdownRow } from '../types'

function crmRow(id: string, over: Partial<AdPerformanceRow> = {}): AdPerformanceRow {
  return {
    id, name: id, status: 'ACTIVE', spend: 0, impressions: 0, clicks: 0, meta_leads: 0,
    lead_count: 0, qualified_count: 0, closed_count: 0, calls_count: 0, calls_reached: 0,
    bookings_total: 0, bookings_show_up: 0, revenue: 0, cash_collected: 0, cpl: null, cpl_qualified: null, roas: null,
    ...over,
  }
}

function metaRow(id: string, over: Partial<MetaBreakdownRow> = {}): MetaBreakdownRow {
  return {
    id, name: id, status: 'ACTIVE', campaign_type: 'leadform', spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, cpl: null,
    frequency: 0, video_plays: 0, video_p25: 0, video_p50: 0, video_p75: 0, hook_rate: 0, hold_rate_25: 0, hold_rate_50: 0, hold_rate_75: 0,
    ...over,
  }
}

describe('evaluateHealthColor', () => {
  it('lower_is_better (cpl defaults 7.5/15/30)', () => {
    expect(evaluateHealthColor('cpl', 5)).toBe('green')
    expect(evaluateHealthColor('cpl', 12)).toBe('orange')
    expect(evaluateHealthColor('cpl', 25)).toBe('orange')
    expect(evaluateHealthColor('cpl', 40)).toBe('red')
  })
  it('higher_is_better (roas defaults 3/1/0.5)', () => {
    expect(evaluateHealthColor('roas', 3.2)).toBe('green')
    expect(evaluateHealthColor('roas', 0.7)).toBe('orange')
    expect(evaluateHealthColor('roas', 0.2)).toBe('red')
  })
  it('applies overrides, and falls back to defaults when inverted', () => {
    expect(evaluateHealthColor('cpl', 12, { cpl: { green: 15 } })).toBe('green')
    expect(evaluateHealthColor('cpl', 12, { cpl: { green: 50, orange: 10, red: 5 } })).toBe('orange')
  })
  it('returns null for unknown KPI or null value', () => {
    expect(evaluateHealthColor('nope', 1)).toBeNull()
    expect(evaluateHealthColor('cpl', null)).toBeNull()
  })
  it('effectiveThreshold merges overrides', () => {
    expect(effectiveThreshold('cpl', { cpl: { orange: 20 } })).toEqual({ green: 7.5, orange: 20, red: 30 })
  })
})

describe('periods', () => {
  it('presetRange mirrors the insights route', () => {
    const now = new Date('2026-09-25T12:00:00Z')
    expect(presetRange('today', now)).toEqual({ dateFrom: '2026-09-25', dateTo: '2026-09-25' })
    expect(presetRange('7d', now)).toEqual({ dateFrom: '2026-09-18', dateTo: '2026-09-25' })
  })
  it('previousRange is the same-length window just before', () => {
    expect(previousRange('2026-09-18', '2026-09-25')).toEqual({ dateFrom: '2026-09-10', dateTo: '2026-09-17' })
  })
  it('deltaPct has no base when previous is 0', () => {
    expect(deltaPct(10, 0)).toBeNull()
    expect(deltaPct(15, 10)).toBe(50)
  })
})

describe('CRM aggregation', () => {
  it('splits by campaign type with an unattributed bucket', () => {
    const rows = [
      crmRow('c1', { lead_count: 3, closed_count: 1, revenue: 1000 }),
      crmRow('c2', { lead_count: 2 }),
      crmRow('__unattributed__', { lead_count: 4 }),
      crmRow('gone', { lead_count: 1 }),
    ]
    const split = crmByCampaignType(rows, [metaRow('c1'), metaRow('c2', { campaign_type: 'follow_ads' })])
    expect(split.leadform.lead_count).toBe(3)
    expect(split.leadform.revenue).toBe(1000)
    expect(split.follow_ads.lead_count).toBe(2)
    expect(split.unattributed.lead_count).toBe(4)
    expect(split.other.lead_count).toBe(1)
    expect(sumCrm(rows).lead_count).toBe(10)
  })
})

describe('columns', () => {
  it('computes funnel ratios like the web and null when undefined', () => {
    const row = metaRow('a', { spend: 100, clicks: 50, impressions: 10000 })
    const crm = crmRow('a', { lead_count: 5, calls_count: 4, calls_reached: 2, bookings_total: 1, closed_count: 0, revenue: 300 })
    expect(columnValue(row, crm, 'cpm')).toBe(10)
    expect(columnValue(row, crm, 'cr1')).toBe(10)
    expect(columnValue(row, crm, 'joignabilite')).toBe(50)
    expect(columnValue(row, crm, 'cpclose')).toBeNull()
    expect(columnValue(row, crm, 'marge_brute')).toBe(200)
    expect(columnValue(row, undefined, 'crm_leads')).toBe(0)
    expect(columnValue(row, undefined, 'roas')).toBeNull()
  })
  it('formats values', () => {
    expect(formatColumnValue('cpclose', null)).toBe('—')
    expect(formatColumnValue('cr2', 42.4)).toBe('42 %')
    expect(formatColumnValue('roas', 2.5)).toBe('2,50x')
  })
  it('sanitizes and reorders columns', () => {
    expect(sanitizeColumns(['spend', 'bogus'])).toEqual(['name', 'spend'])
    expect(sanitizeColumns('x')).toBeNull()
    expect(moveColumn(['name', 'spend', 'roas'], 'roas', 1)).toEqual(['name', 'roas', 'spend'])
  })
})
