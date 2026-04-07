'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Eye, Users, MessageCircle, LogOut, TrendingDown, ChevronDown } from 'lucide-react'
import { IG_SEQ_TYPES } from './constants'
import dynamic from 'next/dynamic'
import type { IgStory, StorySequence, StorySequenceItem } from '@/types'

const IgSequenceModal = dynamic(() => import('./IgSequenceModal'), { ssr: false })
import IgSequenceDetail from './IgSequenceDetail'

function getWeekDays(offset: number) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const days: { date: string; label: string; dayNum: number }[] = []
  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push({
      date: d.toISOString().slice(0, 10),
      label: labels[i],
      dayNum: d.getDate(),
    })
  }
  return days
}

function formatWeekLabel(days: { date: string }[]) {
  const start = new Date(days[0].date)
  const end = new Date(days[6].date)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${start.toLocaleDateString('fr-FR', opts)} — ${end.toLocaleDateString('fr-FR', opts)} ${end.getFullYear()}`
}

function SkeletonBlock({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div style={{
      width, height, borderRadius: 8, background: 'var(--bg-elevated)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components for the revamped display                    */
/* ------------------------------------------------------------------ */

/** Big story thumbnail with data overlay */
function StoryCard({
  story,
  position,
  width,
  height,
}: {
  story?: IgStory
  position: number
  width: number
  height: number
}) {
  const impressions = story?.impressions ?? 0
  const reach = story?.reach ?? 0
  const replies = story?.replies ?? 0
  const imgSrc = story?.thumbnail_url || story?.ig_media_url || ''

  return (
    <div style={{ width, flexShrink: 0 }}>
      <div style={{
        width, height, borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-elevated)',
        position: 'relative',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        border: '1px solid var(--border-primary)',
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 500 }}>
              Story {position}
            </span>
          </div>
        )}

        {/* Gradient overlay for readability */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '55%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          borderRadius: '0 0 14px 14px',
        }} />

        {/* Big impressions number */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
            <Eye size={14} style={{ color: '#fff', opacity: 0.8, position: 'relative', top: 2 }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
              {impressions.toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Users size={11} /> {reach.toLocaleString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <MessageCircle size={11} /> {replies}
            </span>
          </div>
        </div>

        {/* Position badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '3px 8px',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>
          {position}
        </div>
      </div>
    </div>
  )
}

/** Drop-off arrow between two stories */
function DropOffArrow({ percentage }: { percentage: number }) {
  const pct = Math.min(100, Math.max(0, percentage))
  const color = pct > 30 ? '#ef4444' : pct > 15 ? '#f97316' : '#22c55e'
  const bgColor = pct > 30 ? 'rgba(239,68,68,0.12)' : pct > 15 ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minWidth: 56, gap: 4, flexShrink: 0,
      alignSelf: 'center',
    }}>
      <div style={{
        background: bgColor,
        border: `1px solid ${color}33`,
        borderRadius: 10,
        padding: '6px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}>
        <TrendingDown size={16} style={{ color }} />
        <span style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: -0.3 }}>
          -{pct}%
        </span>
      </div>
      <ChevronDown size={14} style={{ color, opacity: 0.6 }} />
    </div>
  )
}

/** Retention funnel bar for a sequence */
function RetentionFunnel({ items }: { items: StorySequenceItem[] }) {
  if (items.length === 0) return null
  const firstImpressions = items[0].story?.impressions ?? 0
  if (firstImpressions === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Retention
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 3, alignItems: 'flex-end',
        height: 36, borderRadius: 8, overflow: 'hidden',
        background: 'var(--bg-elevated)',
        padding: 3,
      }}>
        {items.map((item, idx) => {
          const imp = item.story?.impressions ?? 0
          const pct = firstImpressions > 0 ? (imp / firstImpressions) * 100 : 0
          const clampedPct = Math.min(100, Math.max(4, pct))
          // Color gradient from green to red
          const hue = (pct / 100) * 120 // 120=green, 0=red
          const barColor = `hsl(${hue}, 70%, 50%)`
          return (
            <div
              key={item.id}
              style={{
                flex: 1,
                height: `${clampedPct}%`,
                background: barColor,
                borderRadius: 4,
                position: 'relative',
                minWidth: 0,
                transition: 'height 0.3s ease',
              }}
              title={`Story ${idx + 1}: ${imp.toLocaleString()} vues (${Math.round(pct)}%)`}
            >
              {items.length <= 8 && (
                <div style={{
                  position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                }}>
                  {Math.round(pct)}%
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 10, color: 'var(--text-tertiary)',
      }}>
        <span>{firstImpressions.toLocaleString()} vues</span>
        <span>{(items[items.length - 1].story?.impressions ?? 0).toLocaleString()} vues</span>
      </div>
    </div>
  )
}


/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function IgStoriesTab() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(new Date().toISOString().slice(0, 10))
  const [stories, setStories] = useState<IgStory[]>([])
  const [sequences, setSequences] = useState<StorySequence[]>([])
  const [seqItems, setSeqItems] = useState<Record<string, StorySequenceItem[]>>({})
  const [showModal, setShowModal] = useState(false)
  const [detailSeq, setDetailSeq] = useState<StorySequence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const days = getWeekDays(weekOffset)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [storiesRes, seqRes] = await Promise.all([
        fetch('/api/instagram/stories'),
        fetch('/api/instagram/sequences'),
      ])
      if (!storiesRes.ok || !seqRes.ok) throw new Error('Erreur lors du chargement des donnees')
      const [storiesJson, seqJson] = await Promise.all([storiesRes.json(), seqRes.json()])
      setStories(storiesJson.data ?? [])
      const seqs: StorySequence[] = seqJson.data ?? []
      setSequences(seqs)

      // Fetch items for each sequence
      const itemsMap: Record<string, StorySequenceItem[]> = {}
      await Promise.all(seqs.map(async (seq) => {
        const res = await fetch(`/api/instagram/sequences/${seq.id}/items`)
        if (res.ok) {
          const json = await res.json()
          itemsMap[seq.id] = json.data ?? []
        } else {
          itemsMap[seq.id] = []
        }
      }))
      setSeqItems(itemsMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Preserve selectedDay when changing week
  useEffect(() => {
    const dayDates = days.map(d => d.date)
    if (selectedDay && dayDates.includes(selectedDay)) return
    setSelectedDay(days[0]?.date ?? null)
  }, [weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  // All sequence story IDs (for orphan detection)
  const allSeqStoryIds = useMemo(() => {
    return new Set(Object.values(seqItems).flat().map(item => item.story_id))
  }, [seqItems])

  // Day-filtered sequences
  const daySequences = useMemo(() => {
    return sequences.filter(seq => {
      const seqDate = (seq.published_at || seq.created_at).slice(0, 10)
      return seqDate === selectedDay
    })
  }, [sequences, selectedDay])

  // Day-filtered stories & orphans
  const dayStories = useMemo(() => {
    return stories
      .filter(s => s.published_at.slice(0, 10) === selectedDay)
      .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
  }, [stories, selectedDay])

  const dayOrphanStories = useMemo(() => {
    return dayStories.filter(s => !allSeqStoryIds.has(s.id))
  }, [dayStories, allSeqStoryIds])

  // ALL orphan stories (any day, not in a sequence)
  const allOrphanStories = useMemo(() => {
    return stories
      .filter(s => !allSeqStoryIds.has(s.id))
      .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
  }, [stories, allSeqStoryIds])

  // Orphans NOT in the current day (to show in the "all orphans" section)
  const otherOrphanStories = useMemo(() => {
    return allOrphanStories.filter(s => s.published_at.slice(0, 10) !== selectedDay)
  }, [allOrphanStories, selectedDay])

  // Days with sequences (green dots)
  const seqDays = useMemo(() => {
    return new Set(sequences.map(s => (s.published_at || s.created_at).slice(0, 10)))
  }, [sequences])

  // KPIs for selected day
  const dayImpressions = dayStories.reduce((s, st) => s + st.impressions, 0)
  const dayReach = dayStories.reduce((s, st) => s + st.reach, 0)
  const dayReplies = dayStories.reduce((s, st) => s + st.replies, 0)
  const dayExits = dayStories.reduce((s, st) => s + st.exits, 0)

  if (detailSeq) {
    return (
      <IgSequenceDetail
        sequence={detailSeq}
        onBack={() => setDetailSeq(null)}
        onRefresh={fetchData}
      />
    )
  }

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <SkeletonBlock width={20} height={20} />
          <SkeletonBlock width={260} height={20} />
          <SkeletonBlock width={20} height={20} />
          <div style={{ flex: 1 }} />
          <SkeletonBlock width={160} height={36} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} width={52} height={60} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} width="100%" height={72} />
          ))}
        </div>
        <SkeletonBlock width="100%" height={340} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    )
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div style={{
          background: '#ef444422', border: '1px solid #ef4444', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
          <button onClick={fetchData} style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: '1px solid #ef4444', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 260, textAlign: 'center' }}>
          {formatWeekLabel(days)}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <ChevronRight size={20} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            color: '#fff', background: 'var(--color-primary)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nouvelle séquence
        </button>
      </div>

      {/* Day buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, border: '1px solid var(--border-primary)' }}>
        {days.map(d => {
          const isActive = selectedDay === d.date
          const hasDot = seqDays.has(d.date)
          const isToday = d.date === new Date().toISOString().slice(0, 10)
          return (
            <button
              key={d.date}
              onClick={() => setSelectedDay(d.date)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? 'var(--color-primary)' : 'transparent',
                border: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                minWidth: 52,
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{d.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{d.dayNum}</span>
              {hasDot && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? '#fff' : '#22c55e' }} />}
              {isToday && !isActive && <div style={{ position: 'absolute', bottom: 3, width: 16, height: 2, borderRadius: 1, background: 'var(--color-primary)' }} />}
            </button>
          )
        })}
      </div>

      {/* KPI cards — expanded with reach & exits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Stories', value: dayStories.length, icon: <Eye size={14} /> },
          { label: 'Impressions', value: dayImpressions.toLocaleString(), icon: <Eye size={14} /> },
          { label: 'Reach', value: dayReach.toLocaleString(), icon: <Users size={14} /> },
          { label: 'Replies', value: dayReplies, icon: <MessageCircle size={14} /> },
          { label: 'Exits', value: dayExits, icon: <LogOut size={14} /> },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 12, padding: '14px 18px',
            transition: 'border-color 0.2s ease, transform 0.2s ease', cursor: 'default',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{kpi.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  DAY SEQUENCES — Big cards with horizontal story scroll      */}
      {/* ============================================================ */}
      {daySequences.map(seq => {
        const items = seqItems[seq.id] ?? []
        const seqType = IG_SEQ_TYPES[seq.sequence_type as keyof typeof IG_SEQ_TYPES]
        return (
          <div
            key={seq.id}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              borderRadius: 16, padding: 24, marginBottom: 20, cursor: 'pointer',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            onClick={() => setDetailSeq(seq)}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--color-primary), 0 8px 32px rgba(0,0,0,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-primary)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Header: name + type badge + summary stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{seq.name}</span>
              {seqType && (
                <span style={{
                  padding: '3px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20,
                  background: seqType.color + '22', color: seqType.color,
                  border: `1px solid ${seqType.color}44`,
                }}>
                  {seqType.label}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                <span>{seq.total_impressions.toLocaleString()} impressions</span>
                <span style={{ color: seq.overall_dropoff_rate > 30 ? '#ef4444' : seq.overall_dropoff_rate > 15 ? '#f97316' : '#22c55e' }}>
                  {Math.min(100, Math.max(0, Math.round(seq.overall_dropoff_rate)))}% drop-off
                </span>
              </div>
            </div>
            {seq.objective && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.4 }}>{seq.objective}</p>
            )}

            {/* Stories — BIG centered thumbnails with drop-off arrows */}
            <div style={{
              display: 'flex', gap: 0, alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              paddingBottom: 12, paddingTop: 8,
            }}>
              {items.map((item, idx) => {
                const story = item.story
                const prevImpressions = idx > 0 ? (items[idx - 1].story?.impressions ?? 0) : 0
                const curImpressions = story?.impressions ?? 0
                const rawDropPct = idx > 0 && prevImpressions > 0
                  ? Math.round((1 - curImpressions / prevImpressions) * 100)
                  : 0

                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center' }}>
                    {idx > 0 && <DropOffArrow percentage={rawDropPct} />}
                    <StoryCard
                      story={story}
                      position={item.position}
                      width={200}
                      height={356}
                    />
                  </div>
                )
              })}
            </div>

            {/* Retention funnel bar */}
            <RetentionFunnel items={items} />
          </div>
        )
      })}

      {daySequences.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14,
          background: 'var(--bg-secondary)', borderRadius: 16,
          border: '1px dashed var(--border-primary)', marginBottom: 20,
        }}>
          Aucune séquence pour ce jour
        </div>
      )}

      {/* ============================================================ */}
      {/*  DAY ORPHAN STORIES — 140x248 with data overlay              */}
      {/* ============================================================ */}
      {dayOrphanStories.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Stories hors séquence — {selectedDay && new Date(selectedDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {dayOrphanStories.map(s => (
              <StoryCard key={s.id} story={s} position={0} width={140} height={248} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  ALL OTHER ORPHAN STORIES (not in selected day)              */}
      {/* ============================================================ */}
      {otherOrphanStories.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Toutes les stories hors séquence
          </h4>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 14 }}>
            {otherOrphanStories.length} stories non assignées à une séquence
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {otherOrphanStories.map(s => (
              <div key={s.id} style={{ position: 'relative' }}>
                <StoryCard story={s} position={0} width={140} height={248} />
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  borderRadius: 6, padding: '2px 7px',
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                }}>
                  {new Date(s.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  ALL SEQUENCES TABLE                                          */}
      {/* ============================================================ */}
      {sequences.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>Toutes les séquences</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nom', 'Type', 'Stories', 'Impressions', 'Drop-off', 'Replies', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sequences.map(seq => {
                const seqType = IG_SEQ_TYPES[seq.sequence_type as keyof typeof IG_SEQ_TYPES]
                const items = seqItems[seq.id] ?? []
                const dropColor = seq.overall_dropoff_rate > 30 ? '#ef4444' : seq.overall_dropoff_rate > 15 ? '#f97316' : '#22c55e'
                return (
                  <tr key={seq.id} onClick={() => setDetailSeq(seq)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-primary)', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{seq.name}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {seqType && <span style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 20, background: seqType.color + '22', color: seqType.color }}>{seqType.label}</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{items.length}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{seq.total_impressions.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: dropColor }}>{Math.min(100, Math.max(0, Math.round(seq.overall_dropoff_rate)))}%</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{seq.total_replies}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {new Date(seq.published_at || seq.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <IgSequenceModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData() }}
        />
      )}
    </div>
  )
}
