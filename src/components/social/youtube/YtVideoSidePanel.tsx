'use client'

import { useEffect, useState } from 'react'
import { X, Eye, ThumbsUp, MessageCircle, Clock, ExternalLink, Loader2 } from 'lucide-react'
import type { YtVideoWithStats } from '@/types'

interface Props {
  videoId: string | null
  onClose: () => void
}

// Cache module-scope : une vidéo déjà ouverte ne re-fetch pas. Évite le
// spinner systématique quand on switch entre 2 vidéos. TTL 60s pour
// rafraîchir naturellement les stats si l'utilisateur revient plus tard.
const videoCache = new Map<string, { data: YtVideoWithStats; ts: number }>()
const CACHE_TTL_MS = 60_000

export default function YtVideoSidePanel({ videoId, onClose }: Props) {
  const [video, setVideo] = useState<YtVideoWithStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoId) return

    const cached = videoCache.get(videoId)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setVideo(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false
    fetch(`/api/youtube/videos/${videoId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.data) videoCache.set(videoId, { data: j.data, ts: Date.now() })
        setVideo(j.data)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [videoId])

  useEffect(() => {
    if (videoId) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [videoId])

  if (!videoId) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 998,
        }}
      />
      {/* Side panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 720, maxWidth: '100vw',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-primary)',
          zIndex: 999,
          overflowY: 'auto',
          animation: 'slideIn 0.2s ease-out',
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            Détail vidéo
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer',
              padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {loading || !video ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Embed YouTube player */}
              <div style={{
                position: 'relative', paddingBottom: video.format === 'short' ? '177.78%' : '56.25%',
                height: 0, borderRadius: 10, overflow: 'hidden', marginBottom: 18,
                background: '#000',
                maxWidth: video.format === 'short' ? 280 : '100%',
                marginLeft: video.format === 'short' ? 'auto' : 0,
                marginRight: video.format === 'short' ? 'auto' : 0,
              }}>
                <iframe
                  src={`https://www.youtube.com/embed/${video.yt_video_id}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: '100%', border: 'none',
                  }}
                />
              </div>

              {/* Title + meta */}
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                {video.title ?? '(sans titre)'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                {video.format === 'short' && <span style={{ background: '#FF0000', color: '#fff', padding: '2px 6px', borderRadius: 3, marginRight: 8, fontSize: 10, fontWeight: 700 }}>SHORT</span>}
                {video.published_at ? new Date(video.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                {video.duration_seconds != null && ` · ${fmtDuration(video.duration_seconds)}`}
                {video.privacy_status && ` · ${video.privacy_status}`}
              </div>

              <a
                href={video.video_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: '#FF0000', textDecoration: 'none', fontWeight: 600,
                  marginBottom: 20,
                }}
              >
                Voir sur YouTube <ExternalLink size={12} />
              </a>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
                <Stat icon={Eye} label="Vues" value={fmt(video.views)} color="#5b9bf5" />
                <Stat icon={ThumbsUp} label="Likes" value={fmt(video.likes)} color="#38A169" />
                <Stat icon={MessageCircle} label="Comments" value={fmt(video.comments)} color="#8B5CF6" />
                <Stat icon={Clock} label="Watch time" value={`${fmt(video.watch_time_minutes)} min`} color="#F97316" />
                <Stat icon={Eye} label="Durée moyenne" value={`${video.average_view_duration_sec}s`} color="#EC4899" hint={`${video.average_view_percentage.toFixed(1)}% vu`} />
                {video.estimated_revenue != null && (
                  <Stat icon={Eye} label="Revenu" value={`${video.estimated_revenue.toFixed(2)} €`} color="#D69E2E" />
                )}
              </div>

              {/* Description */}
              {video.description && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel>Description</SectionLabel>
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
                    borderRadius: 8, padding: 12, maxHeight: 180, overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {video.description}
                  </div>
                </div>
              )}

              {/* Daily chart */}
              {video.daily_stats.length > 1 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel>Vues — 30 derniers jours</SectionLabel>
                  <DailyChart data={video.daily_stats.map((d) => ({ date: d.date, value: d.views }))} color="#FF0000" />
                </div>
              )}

              {/* Traffic sources */}
              {video.traffic_sources.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel>Sources de trafic</SectionLabel>
                  <TrafficBreakdown items={video.traffic_sources} />
                </div>
              )}

              {/* Demographics */}
              {video.demographics.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel>Démographie</SectionLabel>
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Stat({ icon: Icon, label, value, color, hint }: {
  icon: typeof Eye; label: string; value: string; color: string; hint?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <Icon size={12} style={{ color }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
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
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 80 }}>
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={pts} />
    </svg>
  )
}

function TrafficBreakdown({ items }: { items: { source_type: string; views: number }[] }) {
  const totals: Record<string, number> = {}
  for (const it of items) totals[it.source_type] = (totals[it.source_type] ?? 0) + it.views
  const total = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a)
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
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`
  if (m === 0) return `${s}s`
  return `${m}m${s.toString().padStart(2, '0')}`
}
