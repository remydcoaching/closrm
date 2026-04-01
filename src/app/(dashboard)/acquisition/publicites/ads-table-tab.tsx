'use client'

import { useState, useMemo } from 'react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsTableTabProps {
  data: MetaInsightsResponse | null
  loading: boolean
  tabKey: string // 'campaigns' | 'adsets' | 'ads' — used to persist column prefs per tab
}

type ColumnKey = 'name' | 'status' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl'
type SortKey = Exclude<ColumnKey, 'status'>
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

interface ColumnDef {
  key: ColumnKey
  label: string
  sortable: boolean
  align: 'left' | 'right'
  defaultVisible: boolean
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Nom', sortable: true, align: 'left', defaultVisible: true },
  { key: 'status', label: 'Statut', sortable: false, align: 'left', defaultVisible: true },
  { key: 'spend', label: 'Dépensé', sortable: true, align: 'right', defaultVisible: true },
  { key: 'impressions', label: 'Impressions', sortable: true, align: 'right', defaultVisible: true },
  { key: 'clicks', label: 'Clics', sortable: true, align: 'right', defaultVisible: true },
  { key: 'ctr', label: 'CTR', sortable: true, align: 'right', defaultVisible: true },
  { key: 'leads', label: 'Leads', sortable: true, align: 'right', defaultVisible: true },
  { key: 'cpl', label: 'CPL', sortable: true, align: 'right', defaultVisible: true },
]

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
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

export default function AdsTableTab({ data, loading, tabKey }: AdsTableTabProps) {
  const [sort, setSort] = useState<SortState>(null) // null = default (spend desc)
  const [search, setSearch] = useState('')
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`ads-columns-${tabKey}`)
      if (saved) {
        try {
          return new Set(JSON.parse(saved) as ColumnKey[])
        } catch { /* ignore */ }
      }
    }
    return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  })
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // Persist column prefs
  function toggleColumn(key: ColumnKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        // Don't allow hiding 'name'
        if (key === 'name') return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(`ads-columns-${tabKey}`, JSON.stringify([...next]))
      }
      return next
    })
  }

  const columns = ALL_COLUMNS.filter(c => visibleCols.has(c.key))

  // Filter by search
  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    if (!q) return data.breakdown
    return data.breakdown.filter(row => row.name.toLowerCase().includes(q))
  }, [data, search])

  // Sort: null = default (spend desc), otherwise by key+dir
  const sorted = useMemo(() => {
    const rows = [...filtered]
    const sortKey = sort?.key ?? 'spend'
    const sortDir = sort?.dir ?? 'desc'

    return rows.sort((a, b) => {
      const valA = a[sortKey] ?? 0
      const valB = b[sortKey] ?? 0
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

  function renderCell(row: (typeof sorted)[0], col: ColumnDef) {
    switch (col.key) {
      case 'name':
        return <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.name}</span>
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
              padding: 8,
              zIndex: 50,
              minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {ALL_COLUMNS.map(col => (
                <label
                  key={col.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 8px',
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
                    onClick={() => col.sortable && col.key !== 'status' && handleSort(col.key as SortKey)}
                  >
                    {col.label}{col.sortable && col.key !== 'status' ? arrow(col.key as SortKey) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.id}
                  style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
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
