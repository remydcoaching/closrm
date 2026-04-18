'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, ThumbsUp, MessageCircle, Clock, ExternalLink } from 'lucide-react'
import type { YtVideoWithStats } from '@/types'

interface Props {
  videoId: string
  onBack: () => void
}

export default function YtVideoDetail({ videoId, onBack }: Props) {
  const [video, setVideo] = useState<YtVideoWithStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/youtube/videos/${videoId}`)
      .then((r) => r.json())
      .then((j) => setVideo(j.data))
      .finally(() => setLoading(false))
  }, [videoId])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!video) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Vidéo introuvable</div>

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', fontSize: 12, fontWeight: 600,
          color: 'var(--text-secondary)', background: 'transparent',
          border: '1px solid var(--border-primary)', borderRadius: 7,
          cursor: 'pointer', marginBottom: 18,
        }}
      >
        <ArrowLeft size={12} /> Retour
      </button>

      {/* Hero */}
      <div style={{
        display: 'flex', gap: 20, marginBottom: 24,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, padding: 20,
      }}>
        {video.thumbnail_url && (
          <img src={video.thumbnail_url} alt="" style={{ width: 240, height: 135, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {video.title ?? '(sans titre)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            {video.format === 'short' && <span style={{ background: '#FF0000', color: '#fff', padding: '1px 6px', borderRadius: 3, marginRight: 8, fontSize: 10 }}>SHORT</span>}
            {video.published_at ? new Date(video.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
          </div>
          {video.description && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, maxHeight: 60, overflow: 'hidden' }}>
              {video.description.slice(0, 250)}{video.description.length > 250 ? '…' : ''}
            </div>
          )}
          <a
            href={video.video_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#FF0000', textDecoration: 'none', fontWeight: 600,
            }}
          >
            Voir sur YouTube <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat icon={Eye} label="Vues" value={fmt(video.views)} color="#5b9bf5" />
        <Stat icon={ThumbsUp} label="Likes" value={fmt(video.likes)} color="#38A169" />
        <Stat icon={MessageCircle} label="Comments" value={fmt(video.comments)} color="#8B5CF6" />
        <Stat icon={Clock} label="Watch time" value={`${fmt(video.watch_time_minutes)} min`} color="#F97316" />
        <Stat icon={Eye} label="Durée moyenne" value={`${video.average_view_duration_sec}s`} color="#EC4899" hint={`${video.average_view_percentage.toFixed(1)}% vu`} />
      </div>

      {/* Daily chart */}
      {video.daily_stats.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Vues — 30 derniers jours
          </div>
          <DailyChart data={video.daily_stats.map((d) => ({ date: d.date, value: d.views }))} color="#FF0000" />
        </div>
      )}

      {/* Traffic sources + demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Sources de trafic</div>
          {video.traffic_sources.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pas encore de données</div>
          ) : (
            <TrafficBreakdown items={video.traffic_sources} />
          )}
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Démographie</div>
          {video.demographics.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pas encore de données</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {video.demographics.slice(0, 8).map((d) => (
                <div key={`${d.age_group}-${d.gender}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 100, color: 'var(--text-tertiary)' }}>{d.age_group.replace('age', '')} · {d.gender}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${d.viewer_percentage}%`, height: '100%', background: '#FF0000' }} />
                  </div>
                  <span style={{ width: 40, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{d.viewer_percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color, hint }: {
  icon: typeof Eye
  label: string
  value: string
  color: string
  hint?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={13} style={{ color }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function DailyChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map((d) => d.value), 1)
  const w = 100
  const h = 60
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - (d.value / max) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 100 }}>
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
    </svg>
  )
}

function TrafficBreakdown({ items }: { items: { source_type: string; views: number }[] }) {
  const totalsBySource = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.source_type] = (acc[it.source_type] ?? 0) + it.views
    return acc
  }, {})
  const total = Object.values(totalsBySource).reduce((a, b) => a + b, 0) || 1
  const sorted = Object.entries(totalsBySource).sort(([, a], [, b]) => b - a)
  const labels: Record<string, string> = {
    BROWSE: 'Page d\'accueil',
    SEARCH: 'Recherche YT',
    SUGGESTED: 'Suggéré',
    EXTERNAL: 'Sites externes',
    PLAYLIST: 'Playlists',
    NOTIFICATION: 'Notifications',
    CHANNEL: 'Page du channel',
    NO_LINK_OTHER: 'Autres',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.slice(0, 8).map(([src, v]) => (
        <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ width: 120, color: 'var(--text-tertiary)' }}>{labels[src] ?? src}</span>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(v / total) * 100}%`, height: '100%', background: '#5b9bf5' }} />
          </div>
          <span style={{ width: 40, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
            {((v / total) * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
