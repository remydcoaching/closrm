'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowUpDown, ExternalLink } from 'lucide-react'

type Level = 'campaign' | 'adset' | 'ad'

interface Row {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  meta_leads: number
  lead_count: number
  qualified_count: number
  closed_count: number
  calls_count: number
  revenue: number
  cash_collected: number
  cpl: number | null
  cpl_qualified: number | null
  roas: number | null
}

interface Props {
  dateFrom: string
  dateTo: string
}

type SortKey = 'name' | 'spend' | 'lead_count' | 'qualified_count' | 'calls_count' | 'closed_count' | 'revenue' | 'cpl' | 'cpl_qualified' | 'roas'

const th: React.CSSProperties = {
  padding: '10px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
  color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--border-primary)', whiteSpace: 'nowrap',
  cursor: 'pointer', userSelect: 'none',
}
const td: React.CSSProperties = {
  padding: '11px 8px', fontSize: 12.5, borderBottom: '1px solid var(--bg-hover)',
  whiteSpace: 'nowrap',
}

function fmtEuro(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}
function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${Math.round(v * 100)}%`
}

export default function AttributionTab({ dateFrom, dateTo }: Props) {
  const [level, setLevel] = useState<Level>('ad')
  const [parent, setParent] = useState<{ campaign?: { id: string; name: string }; adset?: { id: string; name: string } }>({})
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'revenue', asc: false })

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ level, date_from: dateFrom, date_to: dateTo })
      if (parent.campaign) params.set('campaign_id', parent.campaign.id)
      if (parent.adset) params.set('adset_id', parent.adset.id)
      const res = await fetch(`/api/meta/ad-performance?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'error')
        setRows([])
      } else {
        setRows(json.data ?? [])
      }
    } catch {
      setError('network')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [level, dateFrom, dateTo, parent])

  useEffect(() => { fetchRows() }, [fetchRows])

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, asc: !prev.asc } : { key, asc: false })
  }

  const sorted = [...rows].sort((a, b) => {
    const va = a[sort.key] ?? (typeof a[sort.key] === 'number' ? -Infinity : '')
    const vb = b[sort.key] ?? (typeof b[sort.key] === 'number' ? -Infinity : '')
    if (typeof va === 'number' && typeof vb === 'number') return sort.asc ? va - vb : vb - va
    return sort.asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  function drillInto(row: Row) {
    if (level === 'campaign') {
      setParent({ campaign: { id: row.id, name: row.name } })
      setLevel('adset')
    } else if (level === 'adset') {
      setParent(prev => ({ ...prev, adset: { id: row.id, name: row.name } }))
      setLevel('ad')
    }
  }

  function navigateTo(target: 'campaign' | 'adset') {
    if (target === 'campaign') {
      setParent({})
      setLevel('campaign')
    } else {
      setParent(prev => ({ campaign: prev.campaign }))
      setLevel('adset')
    }
  }

  const headerCell = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th style={{ ...th, textAlign: align }} onClick={() => toggleSort(key)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <ArrowUpDown size={10} style={{ opacity: sort.key === key ? 1 : 0.3 }} />
      </span>
    </th>
  )

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 3 }}>
          {(['campaign', 'adset', 'ad'] as Level[]).map(l => (
            <button
              key={l}
              onClick={() => { setLevel(l); if (l === 'campaign') setParent({}); if (l === 'adset') setParent(prev => ({ campaign: prev.campaign })) }}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: level === l ? 'var(--bg-subtle)' : 'transparent',
                color: level === l ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12, fontWeight: level === l ? 600 : 500, cursor: 'pointer',
              }}
            >
              {l === 'campaign' ? 'Campagnes' : l === 'adset' ? 'Ad Sets' : 'Ads'}
            </button>
          ))}
        </div>
        {(parent.campaign || parent.adset) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <button onClick={() => navigateTo('campaign')} style={{ background: 'none', border: 'none', color: '#1877F2', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Toutes les campagnes
            </button>
            {parent.campaign && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>›</span>
                {parent.adset ? (
                  <button onClick={() => navigateTo('adset')} style={{ background: 'none', border: 'none', color: '#1877F2', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                    {parent.campaign.name}
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{parent.campaign.name}</span>
                )}
              </>
            )}
            {parent.adset && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>›</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{parent.adset.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Explanation */}
      <div style={{
        marginBottom: 14, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(24,119,242,0.05)', border: '1px solid rgba(24,119,242,0.15)',
        fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5,
      }}>
        Leads / Qualifiés / Closés / CA = données réelles de ton CRM (Lead Ads uniquement).
        Dépensé / CPM / CPL Meta = Meta Ads Manager. ROAS = CA / Dépensé.
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {headerCell('name', level === 'campaign' ? 'Campagne' : level === 'adset' ? 'Ad Set' : 'Ad')}
              {headerCell('spend', 'Dépensé', 'right')}
              {headerCell('lead_count', 'Leads', 'right')}
              {headerCell('qualified_count', 'Qualifiés', 'right')}
              {headerCell('calls_count', 'Appels', 'right')}
              {headerCell('closed_count', 'Closés', 'right')}
              {headerCell('revenue', 'CA', 'right')}
              {headerCell('cpl', 'CPL', 'right')}
              {headerCell('cpl_qualified', 'CPL qualifié', 'right')}
              {headerCell('roas', 'ROAS', 'right')}
              <th style={{ ...th, textAlign: 'right' }}>Leads</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</td></tr>
            ) : error ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                {error === 'meta_not_connected' ? 'Connecte ton compte Meta dans Intégrations.' : error === 'needs_upgrade' ? 'Reconnecte Meta pour accéder aux données ads.' : 'Erreur lors du chargement.'}
              </td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Aucune donnée sur cette période. Les leads doivent provenir de Lead Ads Meta pour apparaître ici.
              </td></tr>
            ) : sorted.map(row => {
              const clickable = level !== 'ad'
              const urlKey = level === 'campaign' ? 'meta_campaign_id' : level === 'adset' ? 'meta_adset_id' : 'meta_ad_id'
              return (
                <tr
                  key={row.id}
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => clickable && drillInto(row)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...td, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.name}>
                    {row.name}
                    {row.status && row.status !== 'ACTIVE' && (
                      <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'var(--bg-hover)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {row.status.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEuro(row.spend)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{row.lead_count}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#38A169' }}>{row.qualified_count}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{row.calls_count}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>{row.closed_count}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtEuro(row.revenue)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEuro(row.cpl)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtEuro(row.cpl_qualified)}</td>
                  <td style={{ ...td, textAlign: 'right', color: row.roas && row.roas >= 1 ? '#38A169' : row.roas && row.roas < 1 ? '#f59e0b' : 'var(--text-muted)' }}>
                    {fmtPct(row.roas)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/leads?${urlKey}=${row.id}`}
                      title="Voir les leads"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
                        color: 'var(--text-tertiary)', textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={10} />
                      Voir
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
