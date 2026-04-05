'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { IG_PERIODS, IG_GOAL_METRICS } from './constants'
import type { IgSnapshot, IgReel, IgGoal } from '@/types'

interface Props {
  onLinkAccount: () => void
}

function LoadingSkeleton() {
  return (
    <div>
      {/* Period selector skeleton */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ width: 50, height: 30, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      {/* KPI row skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ width: '60%', height: 12, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '80%', height: 24, background: 'var(--bg-elevated)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <div style={{ width: 180, height: 16, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '100%', height: 250, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

export default function IgGeneralTab({ onLinkAccount }: Props) {
  const [period, setPeriod] = useState('30d')
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [goals, setGoals] = useState<IgGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [snapRes, reelsRes, goalsRes] = await Promise.all([
        fetch('/api/instagram/snapshots'),
        fetch('/api/instagram/reels?per_page=100'),
        fetch('/api/instagram/goals'),
      ])
      if (!snapRes.ok || !reelsRes.ok || !goalsRes.ok) {
        throw new Error('Erreur lors du chargement des données')
      }
      const [snapJson, reelsJson, goalsJson] = await Promise.all([
        snapRes.json(), reelsRes.json(), goalsRes.json(),
      ])
      setSnapshots(snapJson.data ?? [])
      setReels(reelsJson.data ?? [])
      setGoals(goalsJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter reels by period
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === '6m' ? 180 : 365
  const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString()
  const filteredReels = reels.filter(r => r.published_at >= cutoff)

  // KPIs
  const latestSnap = snapshots[snapshots.length - 1]
  const totalViews = filteredReels.reduce((s, r) => s + r.views, 0)
  const totalReach = filteredReels.reduce((s, r) => s + r.reach, 0)
  const avgEngagement = filteredReels.length > 0
    ? filteredReels.reduce((s, r) => s + r.engagement_rate, 0) / filteredReels.length
    : 0

  // Growth chart data
  const chartData = snapshots.map(s => ({
    date: s.snapshot_date,
    Followers: s.followers,
    Vues: Number(s.total_views),
    Reach: Number(s.total_reach),
  }))

  // Top reels
  const topReels = [...filteredReels].sort((a, b) => b.views - a.views).slice(0, 10)

  // Current quarter
  const now = new Date()
  const quarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
  const quarterGoals = goals.filter(g => g.quarter === quarter)

  // Helper: get current value for any goal metric
  const getCurrentValueForMetric = (metric: string): number => {
    switch (metric) {
      case 'followers':
        return latestSnap?.followers ?? 0
      case 'views':
      case 'total_views':
        return totalViews
      case 'reach':
      case 'total_reach':
        return totalReach
      case 'engagement':
      case 'engagement_rate':
        return Math.round(avgEngagement * 10) / 10
      case 'reels':
      case 'reels_count':
        return filteredReels.length
      case 'new_followers':
        return latestSnap?.new_followers ?? 0
      default:
        return 0
    }
  }

  if (loading) return <LoadingSkeleton />

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#ef4444', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
      {error}
      <button onClick={fetchData} style={{ display: 'block', margin: '12px auto 0', padding: '6px 16px', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer' }}>Réessayer</button>
    </div>
  )

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3, width: 'fit-content', border: '1px solid var(--border-primary)' }}>
        {IG_PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              color: period === p.value ? '#fff' : 'var(--text-tertiary)',
              background: period === p.value ? 'var(--color-primary)' : 'transparent',
              border: 'none',
              borderRadius: 6, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        <KpiCard label="Followers" value={latestSnap?.followers?.toLocaleString() ?? '—'} />
        <KpiCard label="Nouveaux" value={latestSnap?.new_followers?.toLocaleString() ?? '—'} />
        <KpiCard label="Vues" value={totalViews.toLocaleString()} />
        <KpiCard label="Reach" value={totalReach.toLocaleString()} />
        <KpiCard label="Engagement" value={`${avgEngagement.toFixed(1)}%`} />
      </div>

      {/* Growth chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: '24px 24px 16px', marginBottom: 32,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Tendance de croissance
            </h3>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ label: 'Followers', color: '#3b82f6' }, { label: 'Vues', color: '#22c55e' }, { label: 'Reach', color: '#f97316' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 3, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
              <Line type="monotone" dataKey="Followers" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Vues" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Reach" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Goals */}
      {quarterGoals.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 20, marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Objectifs {quarter}
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {quarterGoals.map(g => {
              const metricLabel = IG_GOAL_METRICS.find(m => m.value === g.metric)?.label ?? g.metric
              const current = getCurrentValueForMetric(g.metric)
              const pct = g.target_value > 0 ? Math.min(100, (current / g.target_value) * 100) : 0
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{metricLabel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {current.toLocaleString()} / {g.target_value.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 3,
                      background: pct >= 100
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : 'linear-gradient(90deg, var(--color-primary), #f97316)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Reels */}
      {topReels.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 20,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Top Reels
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Caption', 'Vues', 'Likes', 'Saves', 'Shares', 'Engagement'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topReels.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background 0.15s ease', cursor: 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.caption?.slice(0, 60) ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.views.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.likes.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.saves.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.shares.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.engagement_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: '16px 20px',
      transition: 'border-color 0.2s ease, transform 0.2s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
