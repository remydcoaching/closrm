'use client'

import { useEffect, useState } from 'react'
import { Search, Video, Eye, ThumbsUp, MessageCircle, Clock, DollarSign, ExternalLink } from 'lucide-react'
import type { YtVideo } from '@/types'
import YtVideoSidePanel from './YtVideoSidePanel'

export default function YtVideosTab() {
  const [videos, setVideos] = useState<YtVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [format, setFormat] = useState<'all' | 'short' | 'long'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Debounce 300ms : sans ça, taper "marketing" déclenche 9 fetches.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (format !== 'all') params.set('format', format)
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('per_page', '100')
    let cancelled = false
    fetch(`/api/youtube/videos?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setVideos(j.data ?? []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [format, debouncedSearch])

  return (
    <div>
      <YtVideoSidePanel videoId={selectedId} onClose={() => setSelectedId(null)} />
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Rechercher une vidéo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 36px', fontSize: 13,
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-surface)', borderRadius: 8 }}>
          {(['all', 'short', 'long'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: format === f ? '#FF0000' : 'transparent',
                color: format === f ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {f === 'all' ? 'Tout' : f === 'short' ? 'Shorts' : 'Vidéos longues'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>
          Chargement…
        </div>
      ) : videos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)',
        }}>
          <Video size={28} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Aucune vidéo {search ? 'trouvée' : 'synchronisée'}.
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)' }}>
                <Th>Vidéo</Th>
                <Th align="right">Vues</Th>
                <Th align="right">Likes</Th>
                <Th align="right">Comments</Th>
                <Th align="right">Watch time</Th>
                <Th align="right">Revenu</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  style={{ borderBottom: '1px solid var(--border-primary)', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 80, height: 45, background: 'var(--bg-surface)', borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 340,
                        }}>{v.title ?? '(sans titre)'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {v.format === 'short' && <span style={{ background: '#FF0000', color: '#fff', padding: '1px 6px', borderRadius: 3, marginRight: 6, fontSize: 9 }}>SHORT</span>}
                          {v.published_at ? new Date(v.published_at).toLocaleDateString('fr-FR') : '—'}
                          {' · '}
                          {v.duration_seconds ? fmtDuration(v.duration_seconds) : '—'}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td align="right"><MetricCell icon={Eye} value={v.views} /></Td>
                  <Td align="right"><MetricCell icon={ThumbsUp} value={v.likes} /></Td>
                  <Td align="right"><MetricCell icon={MessageCircle} value={v.comments} /></Td>
                  <Td align="right"><MetricCell icon={Clock} value={v.watch_time_minutes} suffix=" min" /></Td>
                  <Td align="right">
                    {v.estimated_revenue != null ? (
                      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{v.estimated_revenue.toFixed(2)} €</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <a
                      href={v.video_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '10px 14px', fontSize: 11, fontWeight: 600,
      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
      textAlign: align,
    }}>{children}</th>
  )
}
function Td({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', textAlign: align }}>
      {children}
    </td>
  )
}
function MetricCell({ icon: Icon, value, suffix = '' }: { icon: typeof Eye; value: number; suffix?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <Icon size={12} style={{ color: 'var(--text-muted)' }} />
      <span>{fmt(value)}{suffix}</span>
    </span>
  )
}
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return `${m}m${s.toString().padStart(2, '0')}`
}
