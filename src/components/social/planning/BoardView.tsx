'use client'

import { useState, useMemo } from 'react'
import { Camera, FileText, Film } from 'lucide-react'
import {
  type ContentPillar,
  type SocialPostWithPublications,
  type SocialProductionStatus,
  type SocialContentKind,
  PRODUCTION_STATUSES,
} from '@/types'

interface Props {
  posts: SocialPostWithPublications[]
  pillars: ContentPillar[]
  onSelectSlot: (id: string) => void
  onChange: () => void
}

const KIND_ICON: Record<SocialContentKind, typeof Camera> = {
  post: FileText,
  story: Camera,
  reel: Film,
}

type Period = 'this_week' | 'this_month' | 'next_month' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'Cette semaine',
  this_month: 'Ce mois',
  next_month: 'Mois prochain',
  all: 'Tout',
}

function periodRange(period: Period): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null }
  const now = new Date()
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (period === 'this_week') {
    const dow = (now.getDay() + 6) % 7 // monday-first
    const monday = new Date(now); monday.setDate(now.getDate() - dow)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    return { from: fmt(monday), to: fmt(sunday) }
  }
  if (period === 'this_month') {
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }
  // next_month
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 2, 0)),
  }
}

function weekKey(dateIso: string): string {
  const d = new Date(dateIso)
  const dow = (d.getDay() + 6) % 7
  const monday = new Date(d); monday.setDate(d.getDate() - dow)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function weekLabel(monday: string): string {
  const d = new Date(monday)
  const sunday = new Date(d); sunday.setDate(d.getDate() + 6)
  const fmt = (x: Date) => `${x.getDate()}/${x.getMonth() + 1}`
  return `Sem. ${fmt(d)}–${fmt(sunday)}`
}

export default function BoardView({ posts, pillars, onSelectSlot, onChange }: Props) {
  const [period, setPeriod] = useState<Period>('this_month')
  const [filterKind, setFilterKind] = useState<SocialContentKind | 'all'>('all')
  const [filterPillar, setFilterPillar] = useState<string | 'all'>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const range = useMemo(() => periodRange(period), [period])

  const today = new Date()
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7)
  const cutoff = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`

  const visiblePosts = useMemo(() => {
    return posts.filter((p) => {
      if (filterKind !== 'all' && p.content_kind !== filterKind) return false
      if (filterPillar !== 'all' && p.pillar_id !== filterPillar) return false
      if (range.from && (!p.plan_date || p.plan_date < range.from)) return false
      if (range.to && (!p.plan_date || p.plan_date > range.to)) return false
      if (!showHistory) {
        if (!['draft', 'scheduled', 'failed'].includes(p.status)) return false
        if (p.plan_date && p.plan_date < cutoff && period !== 'all') return false
      }
      return true
    })
  }, [posts, filterKind, filterPillar, range, showHistory, cutoff, period])

  const grouped: Record<SocialProductionStatus, SocialPostWithPublications[]> = {
    idea: [], to_film: [], filmed: [], edited: [], ready: [],
  }
  for (const p of visiblePosts) {
    const ps = (p.production_status ?? 'idea') as SocialProductionStatus
    grouped[ps].push(p)
  }

  const handleDrop = async (status: SocialProductionStatus) => {
    if (!draggedId) return
    const slot = posts.find((p) => p.id === draggedId)
    if (!slot) return
    if (status === 'ready' && (!slot.media_urls || slot.media_urls.length === 0)) {
      alert('Pour passer en "Prêt", il faut au moins un media uploadé.')
      setDraggedId(null)
      return
    }
    setDraggedId(null)
    await fetch(`/api/social/posts/${draggedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_status: status }),
    })
    onChange()
  }

  return (
    <div>
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Period segmented */}
        <div style={segmentedStyle}>
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={segmentBtnStyle(period === p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value as SocialContentKind | 'all')}
          style={selectStyle}
        >
          <option value="all">Tous types</option>
          <option value="post">Posts</option>
          <option value="story">Stories</option>
          <option value="reel">Reels</option>
        </select>

        <select
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Tous pillars</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          Inclure publié / ancien
        </label>

        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {visiblePosts.length} slot{visiblePosts.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', gap: 12 }}>
        {PRODUCTION_STATUSES.map(({ value, label }) => (
          <Column
            key={value}
            value={value}
            label={label}
            posts={grouped[value]}
            pillars={pillars}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(value)}
            onDragStart={setDraggedId}
            onSelectSlot={onSelectSlot}
          />
        ))}
      </div>
    </div>
  )
}

function Column({
  value, label, posts, pillars,
  onDragOver, onDrop, onDragStart, onSelectSlot,
}: {
  value: SocialProductionStatus
  label: string
  posts: SocialPostWithPublications[]
  pillars: ContentPillar[]
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragStart: (id: string) => void
  onSelectSlot: (id: string) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SocialPostWithPublications[]>()
    for (const p of posts) {
      const k = p.plan_date ? weekKey(p.plan_date) : 'no_date'
      const arr = map.get(k) ?? []
      arr.push(p)
      map.set(k, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'no_date') return 1
      if (b === 'no_date') return -1
      return a < b ? -1 : 1
    })
  }, [posts])

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 10, padding: 10,
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 280px)', minHeight: 400, maxHeight: 800,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </h4>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 999 }}>
          {posts.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {posts.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
            Vide
          </div>
        )}
        {grouped.map(([weekStart, weekPosts]) => (
          <div key={weekStart}>
            {grouped.length > 1 && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 2px', borderBottom: '1px solid var(--border-primary)', marginBottom: 6 }}>
                {weekStart === 'no_date' ? 'Sans date' : weekLabel(weekStart)} · {weekPosts.length}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekPosts.map((p) => (
                <Card key={p.id} post={p} pillars={pillars} onDragStart={onDragStart} onClick={() => onSelectSlot(p.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({
  post, pillars, onDragStart, onClick,
}: {
  post: SocialPostWithPublications
  pillars: ContentPillar[]
  onDragStart: (id: string) => void
  onClick: () => void
}) {
  const pillar = pillars.find((x) => x.id === post.pillar_id)
  const Icon = KIND_ICON[(post.content_kind ?? 'post') as SocialContentKind]
  const hasTitle = !!(post.hook ?? post.title)

  return (
    <div
      draggable
      onDragStart={() => onDragStart(post.id)}
      onClick={onClick}
      style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderLeft: `3px solid ${pillar?.color ?? '#666'}`,
        borderRadius: 6, padding: '6px 8px', cursor: 'grab',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: pillar?.color ?? 'var(--text-tertiary)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {pillar?.name ?? '—'}
        </span>
        <Icon size={10} color="var(--text-tertiary)" />
      </div>
      {hasTitle && (
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.hook ?? post.title}
        </div>
      )}
      {post.plan_date && (
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          {formatDate(post.plan_date)}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
}

const segmentedStyle: React.CSSProperties = {
  display: 'flex', gap: 2,
  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
  borderRadius: 8, padding: 2,
}
const segmentBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', fontSize: 11, fontWeight: 600,
  color: active ? '#fff' : 'var(--text-tertiary)',
  background: active ? '#a78bfa' : 'transparent',
  border: 'none', borderRadius: 6, cursor: 'pointer',
  transition: 'all 0.15s',
})
const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
