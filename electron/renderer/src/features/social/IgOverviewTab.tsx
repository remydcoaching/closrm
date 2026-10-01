// Instagram › Vue d'ensemble & objectifs — port of the web's IgGeneralTab
// (period selector, KPIs from snapshots + reels, growth chart, top reels,
// quarterly goals). The web component only displays goals; the desktop also
// lets you set them via the existing POST /api/instagram/goals (upsert).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrMany } from '../../lib/query-cache'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Input } from '../../design-system/Input'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { errMsg } from './http'
import { reelUrl } from './social-utils'
import type { IgGoal, IgReel, IgSnapshot, ListResponse } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
type Period = '7d' | '30d' | '90d' | '6m' | '1y'
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '6m': 180, '1y': 365 }

const GOAL_METRICS: { value: string; label: string }[] = [
  { value: 'followers', label: 'Followers' },
  { value: 'monthly_views', label: 'Vues mensuelles' },
  { value: 'engagement_rate', label: "Taux d'engagement" },
  { value: 'weekly_output', label: 'Posts / semaine' },
  { value: 'dms_month', label: 'DMs / mois' },
  { value: 'viral_reels', label: 'Reels viraux' },
]

function currentQuarter(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`
}

function LineChart({ series }: { series: { label: string; color: string; values: number[] }[] }) {
  const n = series[0]?.values.length ?? 0
  if (n < 2) return null
  const W = 600
  const H = 140
  return (
    <svg className="soc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="var(--color-border)" />
      {series.map((s) => {
        const max = Math.max(...s.values, 1)
        const min = Math.min(...s.values, 0)
        const pts = s.values
          .map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - 4 - ((v - min) / (max - min || 1)) * (H - 12)).toFixed(1)}`)
          .join(' ')
        return <polyline key={s.label} points={pts} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      })}
    </svg>
  )
}

export function IgOverviewTab({ notify }: { notify: Notify }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [goals, setGoals] = useState<IgGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goalMetric, setGoalMetric] = useState('followers')
  const [goalTarget, setGoalTarget] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      await swrMany<[ListResponse<IgSnapshot>, ListResponse<IgReel>, ListResponse<IgGoal>]>(['/api/instagram/snapshots', '/api/instagram/reels?per_page=100', '/api/instagram/goals'], ([s, r, g]) => {
        setSnapshots(s.data ?? [])
        setReels(r.data ?? [])
        setGoals(g.data ?? [])
        setLoading(false)
      })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cutoff = Date.now() - PERIOD_DAYS[period] * 86400000
  const filtered = useMemo(() => reels.filter((r) => Date.parse(r.published_at) >= cutoff), [reels, cutoff])
  const latest = snapshots[snapshots.length - 1]
  const totalViews = filtered.reduce((s, r) => s + r.views, 0)
  const totalReach = filtered.reduce((s, r) => s + r.reach, 0)
  const avgEng = filtered.length ? filtered.reduce((s, r) => s + r.engagement_rate, 0) / filtered.length : null
  const topReels = [...filtered].sort((a, b) => b.views - a.views).slice(0, 10)
  const quarter = currentQuarter()
  const quarterGoals = goals.filter((g) => g.quarter === quarter)

  // Same mapping as the web's getCurrentValueForMetric(); metrics the web
  // cannot compute (monthly_views, weekly_output, dms_month, viral_reels)
  // are shown as "—" instead of a fake 0.
  function currentValue(metric: string): number | null {
    switch (metric) {
      case 'followers':
        return latest?.followers ?? null
      case 'engagement_rate':
        return avgEng === null ? null : Math.round(avgEng * 10) / 10
      default:
        return null
    }
  }

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(goalTarget)
    if (!Number.isFinite(value) || value < 0) return
    setSavingGoal(true)
    try {
      await api.post('/api/instagram/goals', { quarter, metric: goalMetric, target_value: value })
      setGoalTarget('')
      notify('Objectif enregistré')
      void load()
    } catch (err) {
      notify(errMsg(err), 'danger')
    } finally {
      setSavingGoal(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="soc-stack">
      <Chips
        items={[
          { key: '7d', label: '7 jours' },
          { key: '30d', label: '30 jours' },
          { key: '90d', label: '90 jours' },
          { key: '6m', label: '6 mois' },
          { key: '1y', label: '1 an' },
        ]}
        active={period}
        onChange={setPeriod}
      />
      <StatGrid>
        <StatCard label="Followers" value={latest ? latest.followers : '—'} highlight caption="Dernier snapshot" />
        <StatCard label="Nouveaux" value={latest ? latest.new_followers : '—'} caption="Dernier snapshot" />
        <StatCard label="Vues" value={totalViews} caption={`${filtered.length} reels sur la période`} />
        <StatCard label="Reach" value={totalReach} />
        <StatCard label="Engagement" value={avgEng === null ? '—' : `${avgEng.toFixed(1)} %`} />
      </StatGrid>

      <section className="soc-card">
        <h2 className="soc-card-title">Tendance de croissance</h2>
        {snapshots.length < 2 ? (
          <EmptyState title="Pas encore assez de snapshots" description="Les snapshots quotidiens sont créés à chaque synchronisation." />
        ) : (
          <>
            <LineChart
              series={[
                { label: 'Followers', color: '#3b82f6', values: snapshots.map((s) => s.followers) },
                { label: 'Vues', color: '#22c55e', values: snapshots.map((s) => Number(s.total_views)) },
                { label: 'Reach', color: '#f97316', values: snapshots.map((s) => Number(s.total_reach)) },
              ]}
            />
            <div className="soc-legend">
              <span className="soc-row"><span className="soc-dot" style={{ background: '#3b82f6' }} />Followers</span>
              <span className="soc-row"><span className="soc-dot" style={{ background: '#22c55e' }} />Vues</span>
              <span className="soc-row"><span className="soc-dot" style={{ background: '#f97316' }} />Reach</span>
              <span>
                {new Date(snapshots[0].snapshot_date).toLocaleDateString('fr-FR')} → {new Date(snapshots[snapshots.length - 1].snapshot_date).toLocaleDateString('fr-FR')} (échelles indépendantes)
              </span>
            </div>
          </>
        )}
      </section>

      <section className="soc-card">
        <div className="soc-card-head">
          <h2 className="soc-card-title">Objectifs {quarter}</h2>
        </div>
        {quarterGoals.length === 0 && <p className="soc-muted" style={{ margin: 0 }}>Aucun objectif défini pour ce trimestre.</p>}
        {quarterGoals.map((g) => {
          const cur = currentValue(g.metric)
          const pct = cur !== null && g.target_value > 0 ? Math.min(100, (cur / g.target_value) * 100) : 0
          return (
            <div key={g.id} className="soc-field">
              <div className="soc-label">
                <span>{GOAL_METRICS.find((m) => m.value === g.metric)?.label ?? g.metric}</span>
                <span className="ds-num">
                  {cur === null ? '—' : formatNumber(cur)} / {formatNumber(g.target_value)}
                </span>
              </div>
              <div className="soc-bar">
                <span style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--color-success)' : undefined }} />
              </div>
            </div>
          )
        })}
        <form className="soc-row" onSubmit={saveGoal}>
          <select className="soc-select" value={goalMetric} onChange={(e) => setGoalMetric(e.target.value)}>
            {GOAL_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <div style={{ width: 140 }}>
            <Input type="number" min={0} value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Cible" />
          </div>
          <button type="submit" className="ds-pill-button ds-pill-button--dark" disabled={savingGoal || goalTarget === ''}>
            Définir l'objectif
          </button>
        </form>
      </section>

      <TableCard title="Top reels" subtitle="Par vues sur la période">
        {topReels.length === 0 ? (
          <EmptyState title="Aucun reel sur la période" />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Caption</th>
                <th className="ds-num-cell">Vues</th>
                <th className="ds-num-cell">Likes</th>
                <th className="ds-num-cell">Reach</th>
                <th className="ds-num-cell">Engagement</th>
                <th className="ds-num-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {topReels.map((r) => {
                const url = reelUrl(r.ig_media_id)
                return (
                  <tr key={r.id} className="ds-row-clickable" onClick={() => url && window.open(url, '_blank')}>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.caption ?? '—'}</td>
                    <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.views)}</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.likes)}</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{formatNumber(r.reach)}</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{r.engagement_rate.toFixed(1)} %</span></td>
                    <td className="ds-num-cell"><span className="ds-num">{new Date(r.published_at).toLocaleDateString('fr-FR')}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  )
}
