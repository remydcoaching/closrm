'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { IG_PERIODS, IG_GOAL_METRICS } from './constants'
import type { IgSnapshot, IgReel, IgGoal } from '@/types'

interface Props {
  onLinkAccount: () => void
}

export default function IgGeneralTab({ onLinkAccount }: Props) {
  const [period, setPeriod] = useState('30d')
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [goals, setGoals] = useState<IgGoal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [snapRes, reelsRes, goalsRes] = await Promise.all([
      fetch('/api/instagram/snapshots'),
      fetch('/api/instagram/reels?per_page=100'),
      fetch('/api/instagram/goals'),
    ])
    const [snapJson, reelsJson, goalsJson] = await Promise.all([
      snapRes.json(), reelsRes.json(), goalsRes.json(),
    ])
    setSnapshots(snapJson.data ?? [])
    setReels(reelsJson.data ?? [])
    setGoals(goalsJson.data ?? [])
    setLoading(false)
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  }

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {IG_PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              color: period === p.value ? '#fff' : 'var(--text-tertiary)',
              background: period === p.value ? 'var(--bg-elevated)' : 'transparent',
              border: period === p.value ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 6, cursor: 'pointer',
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
          borderRadius: 12, padding: 20, marginBottom: 32,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Tendance de croissance
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
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
              const current = g.metric === 'followers' ? (latestSnap?.followers ?? 0) : 0
              const pct = g.target_value > 0 ? Math.min(100, (current / g.target_value) * 100) : 0
              return (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{metricLabel}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {current} / {g.target_value}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 3,
                      background: pct >= 100 ? '#22c55e' : 'var(--color-primary)',
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
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
