'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, TrendingUp, Users, Flame, ArrowRight, Eye, Heart, MessageCircle } from 'lucide-react'
import type { IgConversation, IgComment, IgReel, IgSnapshot, IgContentPillar } from '@/types'
import AcquisitionInbox, { type InboxItem } from '../AcquisitionInbox'
import { classifyIntent, intentSortValue } from '@/lib/social/intent-classifier'

interface Props {
  onSeeAllInbox: () => void
}

const ACCENT = '#EC4899'

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return n.toString()
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 18,
    }}>
      {children}
    </div>
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

export default function IgAcquisitionTab({ onSeeAllInbox }: Props) {
  const router = useRouter()
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [comments, setComments] = useState<IgComment[]>([])
  const [reels, setReels] = useState<IgReel[]>([])
  const [snapshots, setSnapshots] = useState<IgSnapshot[]>([])
  const [pillars, setPillars] = useState<IgContentPillar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [convRes, comRes, reelsRes, snapRes, pillarsRes] = await Promise.all([
        fetch('/api/instagram/conversations?per_page=30'),
        fetch('/api/instagram/comments'),
        fetch('/api/instagram/reels?per_page=50'),
        fetch('/api/instagram/snapshots'),
        fetch('/api/instagram/pillars'),
      ])
      const [convJson, comJson, reelsJson, snapJson, pillarsJson] = await Promise.all([
        convRes.json(), comRes.json(), reelsRes.json(), snapRes.json(), pillarsRes.json(),
      ])
      setConversations(convJson.data ?? [])
      setComments(comJson.data ?? [])
      setReels(reelsJson.data ?? [])
      setSnapshots(snapJson.data ?? [])
      setPillars(pillarsJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── KPIs ───────────────────────────────────────
  const latestSnap = snapshots[snapshots.length - 1] ?? null
  const followers = latestSnap?.followers ?? 0
  const newFollowers30d = useMemo(() => {
    if (snapshots.length < 2) return latestSnap?.new_followers ?? 0
    const last = snapshots[snapshots.length - 1]
    const ref = snapshots.find(s => {
      const diff = (new Date(last.snapshot_date).getTime() - new Date(s.snapshot_date).getTime()) / 86400000
      return diff <= 30
    })
    return ref ? last.followers - ref.followers : 0
  }, [snapshots, latestSnap])

  // Hot signals = unique items (DMs unread + comments) classified rdv/prix/info
  const inboxItems: InboxItem[] = useMemo(() => {
    const dms: InboxItem[] = conversations.map(c => ({
      id: `dm-${c.id}`,
      source: 'dm',
      username: c.participant_username ?? c.participant_name ?? null,
      avatarUrl: c.participant_avatar_url,
      text: c.last_message_text,
      timestamp: c.last_message_at,
      hasLead: !!c.lead_id,
      onOpen: () => router.push(`/messages?conversation=${c.id}`),
      onCreateLead: c.lead_id ? undefined : () => createLeadFromDM(c),
    }))
    const cms: InboxItem[] = comments.map(c => ({
      id: `cm-${c.id}`,
      source: 'comment',
      username: c.username,
      text: c.text,
      timestamp: c.timestamp,
      context: c.media_caption,
      onCreateLead: () => createLeadFromComment(c),
    }))
    return [...dms, ...cms]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, comments])

  const hotSignals = useMemo(() => {
    return inboxItems.filter(i => {
      const intent = classifyIntent(i.text)
      return intentSortValue(intent) >= 3 // rdv, prix, info, objection
    })
  }, [inboxItems])

  const reels30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000
    return reels.filter(r => r.published_at && new Date(r.published_at).getTime() >= cutoff)
  }, [reels])

  const avgEngagement30d = reels30d.length > 0
    ? reels30d.reduce((s, r) => s + r.engagement_rate, 0) / reels30d.length
    : 0

  const topReels = useMemo(() => {
    return [...reels].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, 5)
  }, [reels])

  const pillarStats = useMemo(() => {
    const map = new Map<string, { pillar: IgContentPillar; count: number; views: number; engagementSum: number }>()
    for (const p of pillars) map.set(p.id, { pillar: p, count: 0, views: 0, engagementSum: 0 })
    for (const r of reels) {
      if (!r.pillar_id) continue
      const stat = map.get(r.pillar_id)
      if (!stat) continue
      stat.count += 1
      stat.views += r.views
      stat.engagementSum += r.engagement_rate
    }
    return Array.from(map.values())
      .filter(s => s.count > 0)
      .map(s => ({
        pillar: s.pillar,
        count: s.count,
        avgViews: s.views / s.count,
        avgEngagement: s.engagementSum / s.count,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
  }, [pillars, reels])

  async function createLeadFromDM(c: IgConversation) {
    const username = c.participant_username ?? c.participant_name ?? ''
    if (!username) return
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: c.participant_name?.split(' ')[0] ?? username,
          last_name:  c.participant_name?.split(' ').slice(1).join(' ') ?? '',
          source: 'instagram_ads',
          notes: `Importé depuis DM Instagram (@${username})`,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data?.id) {
        // Link conversation -> lead
        await fetch(`/api/instagram/conversations/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: json.data.id }),
        }).catch(() => null)
        router.push(`/leads/${json.data.id}`)
      } else {
        alert(json.error ?? 'Impossible de créer le lead')
      }
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function createLeadFromComment(c: IgComment) {
    const username = c.username ?? ''
    if (!username) return
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: username,
          last_name: '',
          source: 'instagram_ads',
          notes: `Commentaire Instagram : "${c.text}"\nSur post : ${c.media_caption ?? '—'}`,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data?.id) router.push(`/leads/${json.data.id}`)
      else alert(json.error ?? 'Impossible de créer le lead')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>
        {error}
        <button onClick={fetchData} style={{ display: 'block', margin: '12px auto 0', padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* HERO KPIs — orientés acquisition */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard
          label="Signaux d'intention"
          value={loading ? '—' : fmt(hotSignals.length)}
          hint="DMs + commentaires (RDV / Prix / Info)"
          icon={Flame}
          accent="#f59e0b"
          highlight={hotSignals.length > 0}
        />
        <KpiCard
          label="Conversations 30j"
          value={loading ? '—' : fmt(conversations.length)}
          hint="DMs avec ton compte"
          icon={Inbox}
          accent={ACCENT}
        />
        <KpiCard
          label="Engagement moyen"
          value={loading ? '—' : `${avgEngagement30d.toFixed(1)}%`}
          hint={`${reels30d.length} reels publiés (30j)`}
          icon={TrendingUp}
          accent="#10b981"
        />
        <KpiCard
          label="Followers"
          value={loading ? '—' : fmt(followers)}
          hint={newFollowers30d >= 0 ? `+${newFollowers30d} sur 30j` : `${newFollowers30d} sur 30j`}
          icon={Users}
          accent="#3b82f6"
        />
      </div>

      {/* INBOX D'ACQUISITION — preview top 6 */}
      <CardShell>
        <SectionHeader
          icon={Inbox}
          title="Inbox d'acquisition"
          subtitle="DMs et commentaires triés par intention d'achat"
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
          emptyLabel="Pas encore de message à traiter — synchronise tes DMs et commentaires depuis le bouton Synchroniser."
        />
      </CardShell>

      {/* TOP CONTENU */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
        <CardShell>
          <SectionHeader
            icon={Eye}
            title="Top contenu (engagement)"
            subtitle="Top 5 reels — ce qui fonctionne le mieux"
          />
          {loading ? (
            <SkeletonRows count={5} />
          ) : topReels.length === 0 ? (
            <EmptyState label="Aucun reel synchronisé pour l’instant." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {topReels.map((r, idx) => {
                const pillar = pillars.find(p => p.id === r.pillar_id)
                const reelUrl = `https://www.instagram.com/reel/${r.ig_media_id}/`
                const accent = pillar?.color ?? ACCENT
                return (
                  <a
                    key={r.id}
                    href={reelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={r.caption ?? 'Reel'}
                    style={{
                      position: 'relative',
                      display: 'flex', flexDirection: 'column',
                      borderRadius: 12,
                      overflow: 'hidden', textDecoration: 'none',
                      border: '1px solid var(--border-primary)',
                      aspectRatio: '9/16',
                      background: r.thumbnail_url
                        ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.85)), url(${r.thumbnail_url}) center/cover`
                        : `linear-gradient(160deg, ${accent}cc 0%, ${accent}33 60%, var(--bg-primary) 100%)`,
                      transition: 'transform 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.borderColor = accent
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.borderColor = 'var(--border-primary)'
                    }}
                  >
                    {/* Top row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: 8,
                    }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#fff',
                      }}>#{idx + 1}</span>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6,
                        background: '#10b981', color: '#fff',
                        fontSize: 10, fontWeight: 800,
                      }}>{r.engagement_rate.toFixed(1)}%</span>
                    </div>

                    {/* Caption (dominant when no thumb) */}
                    <div style={{
                      flex: 1, padding: '4px 10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textAlign: 'center',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3,
                        textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                        display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {r.caption?.replace(/^["“”']+|["“”']+$/g, '').trim() || (
                          <span style={{ fontStyle: 'italic', opacity: 0.65 }}>Sans légende</span>
                        )}
                      </span>
                    </div>

                    {/* Bottom : pillar + stats */}
                    <div style={{
                      padding: '8px 10px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.85) 50%, transparent)',
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      {pillar && (
                        <span style={{
                          alignSelf: 'flex-start',
                          padding: '2px 7px', borderRadius: 4,
                          background: `${pillar.color}`, color: '#fff',
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}>{pillar.name}</span>
                      )}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 10, color: '#fff', fontWeight: 700,
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Eye size={11} /> {fmt(r.views)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Heart size={11} /> {fmt(r.likes)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <MessageCircle size={11} /> {fmt(r.comments)}
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </CardShell>

        <CardShell>
          <SectionHeader
            icon={TrendingUp}
            title="Performance par pillar"
            subtitle="Quel angle convertit le mieux"
            action={(
              <Link
                href="/acquisition/reseaux-sociaux?platform=planning"
                style={{
                  fontSize: 11, fontWeight: 600, color: ACCENT,
                  textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}
              >
                Trame <ArrowRight size={11} />
              </Link>
            )}
          />
          {loading ? (
            <SkeletonRows count={4} />
          ) : pillarStats.length === 0 ? (
            <EmptyState label="Assigne tes reels à des pillars pour voir leur performance." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pillarStats.slice(0, 6).map(stat => {
                const max = pillarStats[0].avgEngagement
                const ratio = max > 0 ? (stat.avgEngagement / max) * 100 : 0
                return (
                  <div key={stat.pillar.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stat.pillar.name}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: stat.pillar.color }}>
                        {stat.avgEngagement.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 6, background: 'var(--bg-elevated)',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${ratio}%`, height: '100%',
                        background: stat.pillar.color, borderRadius: 3, transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {stat.count} reels · {fmt(stat.avgViews)} vues moy.
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardShell>
      </div>
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
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
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
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{hint}</div>
      )}
    </div>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 48, background: 'var(--bg-elevated)', borderRadius: 8,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)',
      background: 'var(--bg-elevated)', borderRadius: 8,
    }}>
      {label}
    </div>
  )
}
