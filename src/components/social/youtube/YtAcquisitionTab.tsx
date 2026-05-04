'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, TrendingUp, Users, Flame, ArrowRight, Eye, ThumbsUp, MessageCircle, RefreshCw, Clock } from 'lucide-react'
import type { YtAccount, YtVideo, YtSnapshot } from '@/types'
import AcquisitionInbox, { type InboxItem } from '../AcquisitionInbox'
import { classifyIntent, intentSortValue } from '@/lib/social/intent-classifier'

interface YtCommentRow {
  id: string
  yt_comment_id: string
  yt_video_id: string
  author_name: string | null
  author_channel_id: string | null
  author_avatar_url: string | null
  text: string | null
  published_at: string | null
  like_count: number
  yt_videos?: { title: string | null; yt_video_id: string } | null
}

interface Props {
  account: YtAccount
  onSync: () => void
  syncing: boolean
  onSeeAllInbox: () => void
}

const ACCENT = '#FF0000'

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return Math.round(n).toString()
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: 18,
    }}>{children}</div>
  )
}

function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ElementType
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${ACCENT}1a`, color: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

export default function YtAcquisitionTab({ account, onSync, syncing, onSeeAllInbox }: Props) {
  const router = useRouter()
  const [videos, setVideos] = useState<YtVideo[]>([])
  const [snapshots, setSnapshots] = useState<YtSnapshot[]>([])
  const [comments, setComments] = useState<YtCommentRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vidsRes, snapsRes, commentsRes] = await Promise.all([
        fetch('/api/youtube/videos?per_page=50'),
        fetch('/api/youtube/snapshots?days=30'),
        fetch('/api/youtube/comments?limit=100'),
      ])
      const [vidsJson, snapsJson, commentsJson] = await Promise.all([
        vidsRes.json(), snapsRes.json(), commentsRes.json(),
      ])
      setVideos(vidsJson.data ?? [])
      setSnapshots(snapsJson.data ?? [])
      setComments(commentsJson.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // KPIs
  const latestSnap = snapshots[snapshots.length - 1] ?? null
  const subscribers = latestSnap?.subscribers ?? account.subscribers_baseline ?? 0
  const totalViews30d = latestSnap?.views_30d ?? 0
  const watchTime30d = latestSnap?.watch_time_minutes_30d ?? 0

  const inboxItems: InboxItem[] = useMemo(() => {
    return comments.map(c => ({
      id: `yt-${c.id}`,
      source: 'comment' as const,
      username: c.author_name,
      avatarUrl: c.author_avatar_url,
      text: c.text,
      timestamp: c.published_at,
      context: c.yt_videos?.title,
      externalUrl: c.yt_videos?.yt_video_id ? `https://youtu.be/${c.yt_videos.yt_video_id}` : null,
      onCreateLead: () => createLeadFromComment(c),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments])

  const hotSignals = useMemo(() => {
    return inboxItems.filter(i => intentSortValue(classifyIntent(i.text)) >= 3)
  }, [inboxItems])

  const topVideos = useMemo(() => {
    return [...videos]
      .sort((a, b) => {
        const ea = a.views > 0 ? (a.likes + a.comments * 2) / a.views : 0
        const eb = b.views > 0 ? (b.likes + b.comments * 2) / b.views : 0
        return eb - ea
      })
      .slice(0, 5)
  }, [videos])

  async function createLeadFromComment(c: YtCommentRow) {
    const username = c.author_name ?? ''
    if (!username) return
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: username,
        last_name: '',
        source: 'manuel',
        notes: `Commentaire YouTube : "${c.text}"\nSur vidéo : ${c.yt_videos?.title ?? '—'}`,
      }),
    })
    const json = await res.json()
    if (res.ok && json.data?.id) router.push(`/leads/${json.data.id}`)
    else alert(json.error ?? 'Impossible de créer le lead')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Account header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
        padding: '12px 18px', background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {account.thumbnail_url && (
            <img src={account.thumbnail_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {account.channel_title ?? 'Chaîne YouTube'}
            </div>
            {account.channel_handle && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{account.channel_handle}</div>
            )}
          </div>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', fontSize: 12, fontWeight: 700,
            color: '#fff', background: ACCENT, border: 'none', borderRadius: 8,
            cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Sync…' : 'Synchroniser'}
        </button>
      </div>

      {/* HERO KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard
          label="Signaux d'intention"
          value={loading ? '—' : fmt(hotSignals.length)}
          hint="Commentaires d’achat / RDV / info"
          icon={Flame}
          accent="#f59e0b"
          highlight={hotSignals.length > 0}
        />
        <KpiCard
          label="Commentaires (30j)"
          value={loading ? '—' : fmt(comments.length)}
          hint="Sur tes dernières vidéos"
          icon={Inbox}
          accent={ACCENT}
        />
        <KpiCard
          label="Vues (30j)"
          value={loading ? '—' : fmt(totalViews30d)}
          hint={watchTime30d > 0 ? `${fmt(watchTime30d)} min de visionnage` : 'Sync pour mettre à jour'}
          icon={Eye}
          accent="#10b981"
        />
        <KpiCard
          label="Abonnés"
          value={loading ? '—' : fmt(subscribers)}
          hint={(latestSnap?.subscribers_gained_30d ?? 0) > 0 ? `+${latestSnap?.subscribers_gained_30d} sur 30j` : 'Croissance 30j'}
          icon={Users}
          accent="#3b82f6"
        />
      </div>

      {/* INBOX */}
      <CardShell>
        <SectionHeader
          icon={Inbox}
          title="Inbox d'acquisition"
          subtitle="Commentaires triés par intention d'achat"
          action={inboxItems.length > 6 && (
            <button
              onClick={onSeeAllInbox}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600,
                color: ACCENT, background: 'transparent',
                border: `1px solid ${ACCENT}40`, borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Voir toute l’inbox <ArrowRight size={11} />
            </button>
          )}
        />
        <AcquisitionInbox
          items={inboxItems}
          loading={loading}
          previewLimit={6}
          accentColor={ACCENT}
          emptyLabel="Aucun commentaire synchronisé. La sync des commentaires YouTube arrive bientôt — utilise le bouton Synchroniser."
        />
      </CardShell>

      {/* TOP VIDEOS */}
      <CardShell>
        <SectionHeader
          icon={TrendingUp}
          title="Top vidéos (engagement)"
          subtitle="Vidéos qui génèrent le plus de réactions"
        />
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                height: 56, background: 'var(--bg-elevated)', borderRadius: 8,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : topVideos.length === 0 ? (
          <div style={{
            padding: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)',
            background: 'var(--bg-elevated)', borderRadius: 8,
          }}>
            Aucune vidéo synchronisée pour l’instant.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topVideos.map((v, idx) => {
              const engagement = v.views > 0 ? ((v.likes + v.comments * 2) / v.views) * 100 : 0
              return (
                <a
                  key={v.id}
                  href={v.video_url ?? `https://youtu.be/${v.yt_video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                    background: 'var(--bg-elevated)', borderRadius: 8,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: 'var(--bg-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                  }}>{idx + 1}</div>
                  <div style={{
                    width: 64, height: 36, borderRadius: 6, flexShrink: 0,
                    background: v.thumbnail_url ? `url(${v.thumbnail_url})` : 'var(--bg-primary)',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {v.title ?? 'Sans titre'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Eye size={9} /> {fmt(v.views)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <ThumbsUp size={9} /> {fmt(v.likes)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <MessageCircle size={9} /> {fmt(v.comments)}
                      </span>
                      {v.watch_time_minutes > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={9} /> {fmt(v.watch_time_minutes)} min
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap',
                  }}>{engagement.toFixed(1)}%</span>
                </a>
              )
            })}
          </div>
        )}
      </CardShell>
    </div>
  )
}

function KpiCard({ label, value, hint, icon: Icon, accent, highlight }: {
  label: string; value: string; hint?: string; icon: React.ElementType; accent: string; highlight?: boolean
}) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${accent}1a, ${accent}05)` : 'var(--bg-secondary)',
      border: `1px solid ${highlight ? accent + '60' : 'var(--border-primary)'}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${accent}1a`, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}
