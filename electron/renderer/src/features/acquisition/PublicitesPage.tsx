// Acquisition > Publicités — reads the EXISTING GET /api/meta/ad-performance
// (same route as the web's publicites-client.tsx). Simplified to the core
// performance table (campaign/adset/ad level, spend/leads/CPL/ROAS) — the
// web's full dashboard also has charts and configurable health thresholds,
// not reproduced here to keep this landing solid rather than half-built.
import { useEffect, useState } from 'react'
import '../../design-system/tabs.css'
import { api, ApiError } from '../../lib/api-client'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import './acquisition.css'
import { TableCard } from '../../design-system/TableCard'
import { StatCard } from '../../design-system/StatCard'

type Level = 'campaign' | 'adset' | 'ad'

interface AdPerformanceRow {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  lead_count: number
  qualified_count: number
  closed_count: number
  revenue: number
  cpl: number | null
  roas: number | null
}

const LEVEL_OPTIONS: { key: Level; label: string }[] = [
  { key: 'campaign', label: 'Campagnes' },
  { key: 'adset', label: 'Ad sets' },
  { key: 'ad', label: 'Ads' },
]

function money(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function PublicitesPage() {
  const [level, setLevel] = useState<Level>('campaign')
  const [rows, setRows] = useState<AdPerformanceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  async function load() {
    setError(null)
    setNotConnected(false)
    try {
      const res = await api.get<{ data: AdPerformanceRow[] }>(`/api/meta/ad-performance?level=${level}`)
      setRows(res.data)
    } catch (err) {
      if (err instanceof ApiError && err.message === 'meta_not_connected') {
        setNotConnected(true)
        setRows([])
      } else {
        setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
      }
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  const totalSpend = (rows ?? []).reduce((s, r) => s + r.spend, 0)
  const totalLeads = (rows ?? []).reduce((s, r) => s + r.lead_count, 0)
  const totalRevenue = (rows ?? []).reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Publicités</h1>
          <p>Performance Meta Ads — 30 derniers jours.</p>
        </div>
        <div className="ig-page-filters">
          {LEVEL_OPTIONS.map((opt) => (
            <button key={opt.key} className={`ds-chip ${level === opt.key ? 'ds-chip--active' : ''}`} onClick={() => setLevel(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {rows === null && !error && !notConnected && <LoadingState label="Chargement des campagnes…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {notConnected && <EmptyState title="Meta non connecté" description="Connectez votre compte Meta Business dans Paramètres > Intégrations pour voir vos performances." />}

      {rows && rows.length > 0 && (
        <>
          <div className="ds-stat-grid">
            <StatCard label="Dépensé" value={money(totalSpend)} />
            <StatCard label="Leads générés" value={totalLeads} />
            <StatCard label="Revenue" value={money(totalRevenue)} />
          </div>

          <TableCard>
            <table className="ds-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Statut</th>
                <th>Dépensé</th>
                <th>Leads</th>
                <th>Qualifiés</th>
                <th>Clos</th>
                <th>CPL</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="ig-cell-name">{row.name}</td>
                  <td className="ds-muted">{row.status}</td>
                  <td className="ds-num-cell ds-num">{money(row.spend)}</td>
                  <td className="ds-num-cell ds-num">{row.lead_count}</td>
                  <td className="ds-num-cell ds-num">{row.qualified_count}</td>
                  <td className="ds-num-cell ds-num">{row.closed_count}</td>
                  <td className="ds-num-cell ds-num">{row.cpl != null ? money(row.cpl) : '—'}</td>
                  <td className="ds-num-cell ds-num">{row.roas != null ? `${row.roas.toFixed(1)}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </TableCard>
        </>
      )}

      {rows && rows.length === 0 && !notConnected && <EmptyState title="Aucune donnée" description="Aucune campagne trouvée pour cette période." />}
    </div>
  )
}
