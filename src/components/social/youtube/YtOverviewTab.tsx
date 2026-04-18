'use client'

import { useEffect, useState } from 'react'
import { Users, Eye, Clock, DollarSign, Video, RefreshCw } from 'lucide-react'
import type { YtAccount, YtSnapshot, YtVideo } from '@/types'

interface Props {
  account: YtAccount
  onSync: () => void
  syncing: boolean
}

export default function YtOverviewTab({ account, onSync, syncing }: Props) {
  const [snapshots, setSnapshots] = useState<YtSnapshot[]>([])
  const [topVideos, setTopVideos] = useState<YtVideo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/youtube/snapshots?days=30').then((r) => r.json()),
      fetch('/api/youtube/videos?per_page=5').then((r) => r.json()),
    ])
      .then(([snaps, vids]) => {
        setSnapshots(snaps.data ?? [])
        setTopVideos((vids.data ?? []).sort((a: YtVideo, b: YtVideo) => b.views - a.views).slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  const latest = snapshots[snapshots.length - 1] ?? null
  const first = snapshots[0] ?? null
  const subsDelta = latest && first ? latest.subscribers - first.subscribers : null
  const viewsDelta = latest && first ? latest.total_views - first.total_views : null

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          {account.thumbnail_url && (
            <img src={account.thumbnail_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', verticalAlign: 'middle', marginRight: 12 }} />
          )}
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {account.channel_title}
          </span>
          {account.channel_handle && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
              @{account.channel_handle}
            </span>
          )}
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#fff', background: '#FF0000', border: 'none', borderRadius: 8,
            cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Sync…' : 'Synchroniser'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiCard
          icon={Users}
          label="Abonnés"
          value={fmt(latest?.subscribers ?? account.subscribers_baseline ?? 0)}
          delta={subsDelta ?? null}
          color="#FF0000"
        />
        <KpiCard
          icon={Eye}
          label="Vues totales"
          value={fmt(latest?.total_views ?? account.total_views_baseline ?? 0)}
          delta={viewsDelta ?? null}
          color="#5b9bf5"
        />
        <KpiCard
          icon={Clock}
          label="Watch time (30j)"
          value={`${fmt(latest?.watch_time_minutes_30d ?? 0)} min`}
          color="#38A169"
        />
        <KpiCard
          icon={DollarSign}
          label="Revenu estimé (30j)"
          value={latest?.estimated_revenue_30d != null ? `${latest.estimated_revenue_30d.toFixed(2)} €` : '—'}
          color="#D69E2E"
          hint={latest?.estimated_revenue_30d == null ? 'Monétisation non activée' : undefined}
        />
      </div>

      {/* Sparkline subscribers */}
      {snapshots.length > 1 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Abonnés — 30 derniers jours
          </div>
          <Sparkline data={snapshots.map((s) => s.subscribers)} color="#FF0000" />
        </div>
      )}

      {/* Top videos */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Top 5 vidéos (par vues)
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</div>
        ) : topVideos.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <Video size={20} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
            Aucune vidéo synchronisée — clique Synchroniser
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topVideos.map((v, i) => (
              <VideoRow key={v.id} video={v} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, delta, color, hint }: {
  icon: typeof Users
  label: string
  value: string
  delta?: number | null
  color: string
  hint?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${color}1F`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {delta != null && delta !== 0 && (
        <div style={{ fontSize: 11, color: delta > 0 ? '#38A169' : '#E53E3E', marginTop: 4, fontWeight: 600 }}>
          {delta > 0 ? '+' : ''}{fmt(delta)} sur 30j
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{hint}</div>
      )}
    </div>
  )
}

function VideoRow({ video, rank }: { video: YtVideo; rank: number }) {
  return (
    <a
      href={video.video_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 10px', borderRadius: 8,
        textDecoration: 'none', color: 'inherit',
        background: 'var(--bg-elevated)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', width: 18 }}>#{rank}</span>
      {video.thumbnail_url ? (
        <img src={video.thumbnail_url} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4 }} />
      ) : (
        <div style={{ width: 64, height: 36, background: 'var(--bg-surface)', borderRadius: 4 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{video.title ?? '(sans titre)'}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {fmt(video.views)} vues · {fmt(video.likes)} likes · {video.format === 'short' ? 'Short' : 'Vidéo'}
        </div>
      </div>
    </a>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 100
  const h = 60
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 80 }}>
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
    </svg>
  )
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
