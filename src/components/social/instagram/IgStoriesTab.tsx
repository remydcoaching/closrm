'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { IG_SEQ_TYPES } from './constants'
import type { IgStory, StorySequence, StorySequenceItem } from '@/types'
import IgSequenceModal from './IgSequenceModal'
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

export default function IgStoriesTab() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [stories, setStories] = useState<IgStory[]>([])
  const [sequences, setSequences] = useState<StorySequence[]>([])
  const [seqItems, setSeqItems] = useState<Record<string, StorySequenceItem[]>>({})
  const [showModal, setShowModal] = useState(false)
  const [detailSeq, setDetailSeq] = useState<StorySequence | null>(null)
  const [loading, setLoading] = useState(true)

  const days = getWeekDays(weekOffset)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [storiesRes, seqRes] = await Promise.all([
      fetch('/api/instagram/stories'),
      fetch('/api/instagram/sequences'),
    ])
    const [storiesJson, seqJson] = await Promise.all([storiesRes.json(), seqRes.json()])
    setStories(storiesJson.data ?? [])
    const seqs: StorySequence[] = seqJson.data ?? []
    setSequences(seqs)

    // Fetch items for each sequence
    const itemsMap: Record<string, StorySequenceItem[]> = {}
    await Promise.all(seqs.map(async (seq) => {
      const res = await fetch(`/api/instagram/sequences/${seq.id}/items`)
      const json = await res.json()
      itemsMap[seq.id] = json.data ?? []
    }))
    setSeqItems(itemsMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedDay && days.length) setSelectedDay(days[0].date)
  }, [weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  if (detailSeq) {
    return (
      <IgSequenceDetail
        sequence={detailSeq}
        onBack={() => setDetailSeq(null)}
        onRefresh={fetchData}
      />
    )
  }

  // Filter sequences by selected day
  const daySequences = sequences.filter(seq => {
    const seqDate = (seq.published_at || seq.created_at).slice(0, 10)
    return seqDate === selectedDay
  })

  // Stories on selected day not in any sequence
  const allSeqStoryIds = new Set(
    Object.values(seqItems).flat().map(item => item.story_id)
  )
  const dayStories = stories.filter(s => s.published_at.slice(0, 10) === selectedDay)
  const orphanStories = dayStories.filter(s => !allSeqStoryIds.has(s.id))

  // Days with sequences (for green dots)
  const seqDays = new Set(sequences.map(s => (s.published_at || s.created_at).slice(0, 10)))

  // KPIs for selected day
  const dayImpressions = dayStories.reduce((s, st) => s + st.impressions, 0)
  const dayReplies = dayStories.reduce((s, st) => s + st.replies, 0)

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>
  }

  return (
    <div>
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {days.map(d => {
          const isActive = selectedDay === d.date
          const hasDot = seqDays.has(d.date)
          return (
            <button
              key={d.date}
              onClick={() => setSelectedDay(d.date)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'var(--color-primary)' : 'var(--bg-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-primary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                minWidth: 52,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500 }}>{d.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{d.dayNum}</span>
              {hasDot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#fff' : '#22c55e' }} />}
            </button>
          )
        })}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Stories', value: dayStories.length },
          { label: 'Impressions', value: dayImpressions.toLocaleString() },
          { label: 'Drop-off', value: daySequences.length > 0 ? `${Math.round(daySequences[0]?.overall_dropoff_rate ?? 0)}%` : '—' },
          { label: 'Replies', value: dayReplies },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Day sequences */}
      {daySequences.map(seq => {
        const items = seqItems[seq.id] ?? []
        const seqType = IG_SEQ_TYPES[seq.sequence_type as keyof typeof IG_SEQ_TYPES]
        return (
          <div
            key={seq.id}
            onClick={() => setDetailSeq(seq)}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              borderRadius: 12, padding: 20, marginBottom: 16, cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{seq.name}</span>
              {seqType && (
                <span style={{
                  padding: '2px 10px', fontSize: 11, fontWeight: 600, borderRadius: 20,
                  background: seqType.color + '22', color: seqType.color,
                }}>
                  {seqType.label}
                </span>
              )}
            </div>
            {seq.objective && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>{seq.objective}</p>}

            {/* Story cards with drop-off */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
              {items.map((item, idx) => {
                const story = item.story
                const prevImpressions = idx > 0 ? (items[idx - 1].story?.impressions ?? 0) : 0
                const curImpressions = story?.impressions ?? 0
                const dropPct = idx > 0 && prevImpressions > 0
                  ? Math.round((1 - curImpressions / prevImpressions) * 100)
                  : 0
                const dropColor = dropPct > 30 ? '#ef4444' : dropPct > 15 ? '#f97316' : '#22c55e'

                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {idx > 0 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: dropColor, minWidth: 40, textAlign: 'center' }}>
                        ↓ {dropPct}%
                      </div>
                    )}
                    <div style={{ width: 130, flexShrink: 0 }}>
                      <div style={{
                        width: 130, height: 230, borderRadius: 8, overflow: 'hidden',
                        background: 'var(--bg-elevated)', marginBottom: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {(story?.thumbnail_url || story?.ig_media_url) ? (
                          <img src={story.thumbnail_url || story.ig_media_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Story {item.position}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Story {item.position}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>
                        <span>Vues {story?.impressions ?? 0}</span>
                        <span>Reach {story?.reach ?? 0}</span>
                        <span>DMs {story?.replies ?? 0}</span>
                        <span>Exits {story?.exits ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {daySequences.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)', marginBottom: 16 }}>
          Aucune séquence pour ce jour
        </div>
      )}

      {/* Orphan stories */}
      {orphanStories.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Stories hors séquence</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {orphanStories.map(s => (
              <div key={s.id} style={{
                width: 90, height: 160, borderRadius: 8, overflow: 'hidden',
                background: 'var(--bg-elevated)',
              }}>
                {(s.thumbnail_url || s.ig_media_url) ? (
                  <img src={s.thumbnail_url || s.ig_media_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>Story</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All sequences table */}
      {sequences.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Toutes les séquences</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nom', 'Type', 'Stories', 'Impressions', 'Drop-off', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sequences.map(seq => {
                const seqType = IG_SEQ_TYPES[seq.sequence_type as keyof typeof IG_SEQ_TYPES]
                const items = seqItems[seq.id] ?? []
                return (
                  <tr key={seq.id} onClick={() => setDetailSeq(seq)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{seq.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {seqType && <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 12, background: seqType.color + '22', color: seqType.color }}>{seqType.label}</span>}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{items.length}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{seq.total_impressions.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(seq.overall_dropoff_rate)}%</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
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
