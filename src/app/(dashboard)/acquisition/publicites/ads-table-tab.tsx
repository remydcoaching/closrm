'use client'

import { useState } from 'react'
import type { MetaInsightsResponse } from '@/app/api/meta/insights/route'

interface AdsTableTabProps {
  data: MetaInsightsResponse | null
  loading: boolean
}

type SortKey = 'name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'leads' | 'cpl'
type SortDir = 'asc' | 'desc'

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
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

export default function AdsTableTab({ data, loading }: AdsTableTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (loading || !data) {
    return <TableSkeleton />
  }

  if (data.breakdown.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 60,
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        Aucune donnée pour cette période
      </div>
    )
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...data.breakdown].sort((a, b) => {
    const valA = a[sortKey] ?? 0
    const valB = b[sortKey] ?? 0
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }
    return sortDir === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number)
  })

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle} onClick={() => handleSort('name')}>Nom{arrow('name')}</th>
            <th style={thStyle}>Statut</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('spend')}>Dépensé{arrow('spend')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('impressions')}>Impressions{arrow('impressions')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('clicks')}>Clics{arrow('clicks')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('ctr')}>CTR{arrow('ctr')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('leads')}>Leads{arrow('leads')}</th>
            <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('cpl')}>CPL{arrow('cpl')}</th>
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
              <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)' }}>{row.name}</td>
              <td style={tdStyle}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: row.status === 'ACTIVE' ? 'rgba(0,200,83,0.1)' : 'rgba(255,255,255,0.05)',
                  color: row.status === 'ACTIVE' ? 'var(--color-primary)' : 'var(--text-muted)',
                }}>
                  {row.status === 'ACTIVE' ? 'Actif' : 'Pausé'}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatEuro(row.spend)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.impressions)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(row.clicks)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.ctr.toFixed(2)}%</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{row.leads}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{row.cpl !== null ? formatEuro(row.cpl) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
