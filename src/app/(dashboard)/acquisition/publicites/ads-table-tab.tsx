'use client'

import { useState, useMemo, useEffect } from 'react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'
import type { CampaignType } from './health-thresholds'

interface CrmFunnelData {
  calls_total: number
  calls_reached: number
  bookings_total: number
  bookings_show_up: number
  closings: number
  deal_amount_total: number
  cash_collected_total: number
}

interface AdsTableTabProps {
  data: MetaInsightsResponse | null
  loading: boolean
  tabKey: string // 'campaigns' | 'adsets' | 'ads' — used to persist column prefs per tab
  campaignType: CampaignType | 'all'
  onRowClick?: (id: string, name: string) => void // drill-down: click campaign → adsets, click adset → ads
  dateFrom?: string
  dateTo?: string
}

type ColumnKey =
  | 'name' | 'status' | 'campaign_type' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl' | 'cpm' | 'cost_per_click'
  // Video Meta
  | 'frequency' | 'hook_rate' | 'hold_rate_25' | 'hold_rate_50' | 'hold_rate_75'
  // CRM funnel — Appels
  | 'cr1' | 'calls_total' | 'calls_reached' | 'cpar' | 'joignabilite' | 'cr2'
  // CRM funnel — Bookings
  | 'bookings_total' | 'cpsb' | 'cr3' | 'bookings_show_up' | 'cpsp' | 'no_show_rate'
  // CRM funnel — Closing
  | 'closings' | 'cpclose' | 'closing_rate'
  // Financier
  | 'deal_amount' | 'cash_collected' | 'marge_brute'

// Columns that are not sortable per-row (CRM data is global, not per-campaign)
const CRM_COLUMNS: Set<ColumnKey> = new Set([
  'cr1', 'calls_total', 'calls_reached', 'cpar', 'joignabilite', 'cr2',
  'bookings_total', 'cpsb', 'cr3', 'bookings_show_up', 'cpsp', 'no_show_rate',
  'closings', 'cpclose', 'closing_rate',
  'deal_amount', 'cash_collected', 'marge_brute',
])

type SortKey = Exclude<ColumnKey, 'status' | 'campaign_type'>
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  align: 'left' | 'right'
  category: string
}

// All column definitions grouped by category
const ALL_COLUMN_DEFS: ColumnDef[] = [
  // Meta Ads (core — always present)
  { key: 'name', label: 'Nom', sortable: true, align: 'left', category: 'Meta Ads' },
  { key: 'status', label: 'Statut', sortable: false, align: 'left', category: 'Meta Ads' },
  { key: 'campaign_type', label: 'Type', sortable: false, align: 'left', category: 'Meta Ads' },
  { key: 'spend', label: 'Dépensé', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'impressions', label: 'Impressions', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'cpm', label: 'CPM', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'clicks', label: 'Clics', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'cost_per_click', label: 'CPC', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'ctr', label: 'CTR', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'leads', label: 'Leads', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'cpl', label: 'CPL', sortable: true, align: 'right', category: 'Meta Ads' },
  { key: 'frequency', label: 'Répétition', sortable: true, align: 'right', category: 'Meta Ads' },
  // Video
  { key: 'hook_rate', label: 'Hook rate', sortable: true, align: 'right', category: 'Video' },
  { key: 'hold_rate_25', label: 'Hold 25%', sortable: true, align: 'right', category: 'Video' },
  { key: 'hold_rate_50', label: 'Hold 50%', sortable: true, align: 'right', category: 'Video' },
  { key: 'hold_rate_75', label: 'Hold 75%', sortable: true, align: 'right', category: 'Video' },
  // Appels
  { key: 'calls_total', label: 'Appels passés', sortable: false, align: 'right', category: 'Appels' },
  { key: 'calls_reached', label: 'Appels répondus', sortable: false, align: 'right', category: 'Appels' },
  { key: 'cpar', label: 'CPAr', sortable: false, align: 'right', category: 'Appels' },
  { key: 'joignabilite', label: '% Joignabilité', sortable: false, align: 'right', category: 'Appels' },
  // Conversions
  { key: 'cr1', label: 'CR1', sortable: false, align: 'right', category: 'Conversions' },
  { key: 'cr2', label: 'CR2', sortable: false, align: 'right', category: 'Conversions' },
  { key: 'cr3', label: 'CR3', sortable: false, align: 'right', category: 'Conversions' },
  // Bookings
  { key: 'bookings_total', label: 'Séances bookées', sortable: false, align: 'right', category: 'Bookings' },
  { key: 'cpsb', label: 'CPSb', sortable: false, align: 'right', category: 'Bookings' },
  { key: 'bookings_show_up', label: 'Séances présentes', sortable: false, align: 'right', category: 'Bookings' },
  { key: 'cpsp', label: 'CPSp', sortable: false, align: 'right', category: 'Bookings' },
  { key: 'no_show_rate', label: '% No show', sortable: false, align: 'right', category: 'Bookings' },
  // Closing
  { key: 'closings', label: 'Closings', sortable: false, align: 'right', category: 'Closing' },
  { key: 'cpclose', label: 'CPClose', sortable: false, align: 'right', category: 'Closing' },
  { key: 'closing_rate', label: '% Closing', sortable: false, align: 'right', category: 'Closing' },
  // Financier
  { key: 'deal_amount', label: 'CA contracté', sortable: false, align: 'right', category: 'Financier' },
  { key: 'cash_collected', label: 'Cash collecté', sortable: false, align: 'right', category: 'Financier' },
  { key: 'marge_brute', label: 'Marge brute', sortable: false, align: 'right', category: 'Financier' },
]

// Category display order for the column picker
const CATEGORY_ORDER = ['Meta Ads', 'Video', 'Appels', 'Conversions', 'Bookings', 'Closing', 'Financier']

// Default visible columns per campaign type
const DEFAULT_VISIBLE_LEADFORM: ColumnKey[] = [
  'name', 'status', 'spend', 'impressions', 'clicks', 'ctr', 'leads', 'cpl',
]
const DEFAULT_VISIBLE_FOLLOW_ADS: ColumnKey[] = [
  'name', 'status', 'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cost_per_click',
]
const DEFAULT_VISIBLE_ALL: ColumnKey[] = [
  'name', 'status', 'campaign_type', 'spend', 'impressions', 'clicks', 'ctr', 'leads', 'cpl',
]

// Build the available columns for a given campaignType.
function getColumnsForType(campaignType: CampaignType | 'all'): ColumnDef[] {
  return ALL_COLUMN_DEFS.filter(col => {
    // campaign_type column only when filter is 'all'
    if (col.key === 'campaign_type' && campaignType !== 'all') return false
    return true
  })
}

function getDefaultVisibleCols(campaignType: CampaignType | 'all'): ColumnKey[] {
  if (campaignType === 'follow_ads') return DEFAULT_VISIBLE_FOLLOW_ADS
  if (campaignType === 'all') return DEFAULT_VISIBLE_ALL
  return DEFAULT_VISIBLE_LEADFORM
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatPct(n: number): string {
  return n.toFixed(1) + '%'
}

/** Returns a colored percentage span: green if above threshold, red if below (inverted if `invertColor`). */
function formatPctColored(value: number, threshold: number, invertColor = false): React.ReactNode {
  const isGood = invertColor ? value < threshold : value >= threshold
  return (
    <span style={{ color: isGood ? '#38A169' : '#E53E3E', fontWeight: 500 }}>
      {value.toFixed(1)}%
    </span>
  )
}

function getStatusLabel(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Actif', bg: 'rgba(0,200,83,0.1)', color: 'var(--color-primary)' }
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Pausé', bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }
    case 'DELETED':
    case 'ARCHIVED':
      return { label: 'Archivé', bg: 'rgba(229,62,62,0.08)', color: '#E53E3E' }
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PENDING_BILLING_INFO':
      return { label: 'En cours', bg: 'rgba(214,158,46,0.1)', color: '#D69E2E' }
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
      return { label: 'Problème', bg: 'rgba(229,62,62,0.08)', color: '#E53E3E' }
    default:
      // Covers statuses like PREAPPROVED, etc.
      return { label: 'Brouillon', bg: 'rgba(100,100,100,0.1)', color: '#888' }
  }
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid var(--border-primary)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  padding: '7px 12px',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
  width: 220,
}

export default function AdsTableTab({ data, loading, tabKey, campaignType, onRowClick, dateFrom, dateTo }: AdsTableTabProps) {
  const [sort, setSort] = useState<SortState>(null) // null = default (spend desc)
  const [search, setSearch] = useState('')
  const [crmData, setCrmData] = useState<CrmFunnelData | null>(null)

  // Available columns depend on the campaign type filter
  const availableColumns = useMemo(() => getColumnsForType(campaignType), [campaignType])

  // Grouped columns for the picker
  const columnsByCategory = useMemo(() => {
    const map = new Map<string, ColumnDef[]>()
    for (const col of availableColumns) {
      const list = map.get(col.category) ?? []
      list.push(col)
      map.set(col.category, list)
    }
    return CATEGORY_ORDER.filter(cat => map.has(cat)).map(cat => ({
      category: cat,
      columns: map.get(cat)!,
    }))
  }, [availableColumns])

  // localStorage key includes campaignType so prefs are scoped per type
  const storageKey = `ads-columns-${tabKey}-${campaignType}`

  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return new Set(JSON.parse(saved) as ColumnKey[])
        } catch { /* ignore */ }
      }
    }
    return new Set(getDefaultVisibleCols(campaignType))
  })
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // When campaignType changes, reset visible columns to defaults for the new type
  // (or restore from its own localStorage key)
  useMemo(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        setVisibleCols(new Set(JSON.parse(saved) as ColumnKey[]))
        return
      } catch { /* ignore */ }
    }
    setVisibleCols(new Set(getDefaultVisibleCols(campaignType)))
  }, [storageKey, campaignType])

  // Fetch CRM funnel data
  useEffect(() => {
    const effectiveDateFrom = dateFrom ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const effectiveDateTo = dateTo ?? new Date().toISOString().slice(0, 10)

    let cancelled = false
    fetch(`/api/performance/crm-funnel?date_from=${effectiveDateFrom}&date_to=${effectiveDateTo}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!cancelled && json?.data) setCrmData(json.data as CrmFunnelData)
      })
      .catch(() => { /* non-critical */ })
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  // Persist column prefs
  function toggleColumn(key: ColumnKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (key === 'name') return prev // can't hide name
        next.delete(key)
      } else {
        next.add(key)
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      }
      return next
    })
  }

  const columns = availableColumns.filter(c => visibleCols.has(c.key))

  // Filter by search
  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    if (!q) return data.breakdown
    return data.breakdown.filter(row => row.name.toLowerCase().includes(q))
  }, [data, search])

  // Helper: get sortable value for a row + key (handles calculated fields like cpm, cost_per_click)
  function getRowValue(row: (typeof filtered)[0], key: SortKey): number | string {
    if (CRM_COLUMNS.has(key)) return 0 // CRM columns are global, not sortable per-row
    if (key === 'cpm') {
      return row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0
    }
    if (key === 'cost_per_click') {
      return row.clicks > 0 ? row.spend / row.clicks : 0
    }
    const v = row[key as keyof typeof row]
    if (v === null || v === undefined) return 0
    return v as number | string
  }

  // Sort: null = default (spend desc), otherwise by key+dir
  const sorted = useMemo(() => {
    const rows = [...filtered]
    const sortKey = sort?.key ?? 'spend'
    const sortDir = sort?.dir ?? 'desc'

    return rows.sort((a, b) => {
      const valA = getRowValue(a, sortKey)
      const valB = getRowValue(b, sortKey)
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortDir === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number)
    })
  }, [filtered, sort])

  if (loading || !data) {
    return <TableSkeleton />
  }

  // Tri-state sort: click 1 = desc, click 2 = asc, click 3 = reset
  function handleSort(key: SortKey) {
    if (!sort || sort.key !== key) {
      setSort({ key, dir: 'desc' })
    } else if (sort.dir === 'desc') {
      setSort({ key, dir: 'asc' })
    } else {
      setSort(null) // reset
    }
  }

  function arrow(key: SortKey): string {
    if (!sort || sort.key !== key) return ''
    return sort.dir === 'asc' ? ' ↑' : ' ↓'
  }

  // Helpers for CRM-derived KPIs (use kpis from data + crmData)
  const kpis = data?.kpis
  const totalSpend = kpis?.spend ?? 0
  const totalLeads = kpis?.leads ?? 0

  function renderCell(row: (typeof sorted)[0], col: ColumnDef) {
    switch (col.key) {
      case 'name':
        return (
          <span style={{ fontWeight: 500, color: onRowClick ? '#1877F2' : 'var(--text-primary)' }}>
            {row.name}{onRowClick ? ' →' : ''}
          </span>
        )
      case 'status': {
        const s = getStatusLabel(row.status)
        return (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: s.bg,
            color: s.color,
          }}>
            {s.label}
          </span>
        )
      }
      case 'campaign_type': {
        const labels: Record<CampaignType, { text: string; color: string }> = {
          leadform: { text: 'Leadform', color: '#1877F2' },
          follow_ads: { text: 'Follow Ads', color: '#8B2BE2' },
          other: { text: 'Autre', color: '#888' },
        }
        const l = labels[row.campaign_type] ?? labels.other
        return (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: `${l.color}1A`,
            color: l.color,
          }}>
            {l.text}
          </span>
        )
      }
      case 'spend':
        return formatEuro(row.spend)
      case 'impressions':
        return formatNumber(row.impressions)
      case 'clicks':
        return formatNumber(row.clicks)
      case 'ctr':
        return row.ctr.toFixed(2) + '%'
      case 'leads':
        return <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{row.leads}</span>
      case 'cpl':
        return row.cpl !== null ? formatEuro(row.cpl) : '—'
      case 'cpm': {
        const cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null
        return cpm !== null ? formatEuro(cpm) : '—'
      }
      case 'cost_per_click': {
        const cpc = row.clicks > 0 ? row.spend / row.clicks : null
        return cpc !== null ? formatEuro(cpc) : '—'
      }

      // ── Video Meta (per-row) ──
      case 'frequency':
        return row.frequency != null ? row.frequency.toFixed(1) : '—'
      case 'hook_rate':
        return row.hook_rate != null ? formatPct(row.hook_rate) : '—'
      case 'hold_rate_25':
        return row.hold_rate_25 != null ? formatPct(row.hold_rate_25) : '—'
      case 'hold_rate_50':
        return row.hold_rate_50 != null ? formatPct(row.hold_rate_50) : '—'
      case 'hold_rate_75':
        return row.hold_rate_75 != null ? formatPct(row.hold_rate_75) : '—'

      // ── CRM Appels (global) ──
      case 'calls_total':
        return crmData ? formatNumber(crmData.calls_total) : '—'
      case 'calls_reached':
        return crmData ? formatNumber(crmData.calls_reached) : '—'
      case 'cpar':
        return crmData && crmData.calls_reached > 0
          ? formatEuro(totalSpend / crmData.calls_reached)
          : '—'
      case 'joignabilite':
        return crmData && crmData.calls_total > 0
          ? formatPctColored((crmData.calls_reached / crmData.calls_total) * 100, 60)
          : '—'

      // ── CRM Conversions (global) ──
      case 'cr1': {
        // CR1 = leads / clicks
        const clicks = kpis?.clicks ?? 0
        return clicks > 0 ? formatPctColored((totalLeads / clicks) * 100, 5) : '—'
      }
      case 'cr2':
        // CR2 = calls_reached / leads
        return crmData && totalLeads > 0
          ? formatPctColored((crmData.calls_reached / totalLeads) * 100, 30)
          : '—'
      case 'cr3':
        // CR3 = closings / bookings_show_up
        return crmData && crmData.bookings_show_up > 0
          ? formatPctColored((crmData.closings / crmData.bookings_show_up) * 100, 20)
          : '—'

      // ── CRM Bookings (global) ──
      case 'bookings_total':
        return crmData ? formatNumber(crmData.bookings_total) : '—'
      case 'cpsb':
        return crmData && crmData.bookings_total > 0
          ? formatEuro(totalSpend / crmData.bookings_total)
          : '—'
      case 'bookings_show_up':
        return crmData ? formatNumber(crmData.bookings_show_up) : '—'
      case 'cpsp':
        return crmData && crmData.bookings_show_up > 0
          ? formatEuro(totalSpend / crmData.bookings_show_up)
          : '—'
      case 'no_show_rate': {
        if (!crmData || crmData.bookings_total === 0) return '—'
        const noShowPct = ((crmData.bookings_total - crmData.bookings_show_up) / crmData.bookings_total) * 100
        // High no-show is bad → invert color logic
        return formatPctColored(noShowPct, 30, true)
      }

      // ── CRM Closing (global) ──
      case 'closings':
        return crmData ? formatNumber(crmData.closings) : '—'
      case 'cpclose':
        return crmData && crmData.closings > 0
          ? formatEuro(totalSpend / crmData.closings)
          : '—'
      case 'closing_rate':
        return crmData && crmData.bookings_show_up > 0
          ? formatPctColored((crmData.closings / crmData.bookings_show_up) * 100, 20)
          : '—'

      // ── Financier (global) ──
      case 'deal_amount':
        return crmData ? formatCurrency(crmData.deal_amount_total) : '—'
      case 'cash_collected':
        return crmData ? formatCurrency(crmData.cash_collected_total) : '—'
      case 'marge_brute':
        return crmData ? formatCurrency(crmData.deal_amount_total - totalSpend) : '—'
    }
  }

  return (
    <div>
      {/* Toolbar: search + column picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Rechercher par nom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColumnPicker(p => !p)}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: showColumnPicker ? 'rgba(24,119,242,0.1)' : 'transparent',
              color: showColumnPicker ? '#1877F2' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Colonnes ▾
          </button>
          {showColumnPicker && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              padding: '8px 4px',
              zIndex: 50,
              minWidth: 200,
              maxHeight: 420,
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {columnsByCategory.map(({ category, columns: cols }) => (
                <div key={category}>
                  <div style={{
                    padding: '8px 10px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {category}
                  </div>
                  {cols.map(col => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: col.key === 'name' ? 'default' : 'pointer',
                        opacity: col.key === 'name' ? 0.5 : 1,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        disabled={col.key === 'name'}
                        onChange={() => toggleColumn(col.key)}
                        style={{ accentColor: '#1877F2' }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          {search ? 'Aucun résultat pour cette recherche' : 'Aucune donnée pour cette période'}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{
                      ...thStyle,
                      textAlign: col.align,
                      cursor: col.sortable ? 'pointer' : 'default',
                    }}
                    onClick={() => col.sortable && col.key !== 'status' && col.key !== 'campaign_type' && handleSort(col.key as SortKey)}
                  >
                    {col.label}{col.sortable && col.key !== 'status' && col.key !== 'campaign_type' ? arrow(col.key as SortKey) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.id}
                  style={{
                    transition: 'background 0.1s',
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                  onClick={() => onRowClick?.(row.id, row.name)}
                  onMouseEnter={e => (e.currentTarget.style.background = onRowClick ? 'rgba(24,119,242,0.04)' : 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ ...tdStyle, textAlign: col.align }}>
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TableSkeleton() {
  const skeletonRow: React.CSSProperties = {
    height: 42,
    background: 'var(--bg-elevated)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ ...skeletonRow, borderBottom: '1px solid var(--border-primary)' }} />
      ))}
    </div>
  )
}
