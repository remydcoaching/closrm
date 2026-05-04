'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Camera, FileText, Film, ChevronDown, Check, Eye, EyeOff } from 'lucide-react'
import {
  type ContentPillar,
  type SocialPostWithPublications,
  type SocialProductionStatus,
  type SocialContentKind,
  PRODUCTION_STATUSES,
} from '@/types'
import { useToast } from '@/components/ui/Toast'

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
  const toast = useToast()
  // Sélectionne automatiquement la période qui contient des slots
  const initialPeriod = useMemo<Period>(() => {
    const counts: Record<Period, number> = { this_week: 0, this_month: 0, next_month: 0, all: posts.length }
    for (const p of posts) {
      if (!p.plan_date) continue
      for (const k of ['this_week', 'this_month', 'next_month'] as Period[]) {
        const r = periodRange(k)
        if (r.from && r.to && p.plan_date >= r.from && p.plan_date <= r.to) counts[k]++
      }
    }
    if (counts.this_week > 0) return 'this_week'
    if (counts.this_month > 0) return 'this_month'
    if (counts.next_month > 0) return 'next_month'
    return 'all'
  }, [posts])
  const [period, setPeriod] = useState<Period>(initialPeriod)
  // Si la période choisie est vide mais une autre a des slots, suggérer
  const periodHasSlots = useMemo(() => {
    if (period === 'all') return posts.length > 0
    const r = periodRange(period)
    return posts.some((p) => p.plan_date && r.from && r.to && p.plan_date >= r.from && p.plan_date <= r.to)
  }, [posts, period])
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
      toast.error('Media manquant', 'Pour passer en "Prêt", il faut au moins un media uploadé.')
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

        <FilterDropdown
          label="Type"
          value={filterKind}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'post', label: 'Posts' },
            { value: 'story', label: 'Stories' },
            { value: 'reel', label: 'Reels' },
          ]}
          onChange={(v) => setFilterKind(v as SocialContentKind | 'all')}
        />

        <FilterDropdown
          label="Pillar"
          value={filterPillar}
          options={[
            { value: 'all', label: 'Tous' },
            ...pillars.map((p) => ({ value: p.id, label: p.name, color: p.color })),
          ]}
          onChange={setFilterPillar}
        />

        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
            color: showHistory ? '#a78bfa' : 'var(--text-tertiary)',
            background: showHistory ? 'rgba(167,139,250,0.1)' : 'var(--bg-secondary)',
            border: `1px solid ${showHistory ? 'rgba(167,139,250,0.4)' : 'var(--border-primary)'}`,
            borderRadius: 8, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {showHistory ? <Eye size={13} /> : <EyeOff size={13} />}
          Publiés / anciens
        </button>

        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          {visiblePosts.length} slot{visiblePosts.length > 1 ? 's' : ''}
        </span>
      </div>

      {!periodHasSlots && posts.length > 0 && (
        <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Aucun slot pour cette période — {posts.length} slots existent ailleurs.</span>
          <button onClick={() => setPeriod('all')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#fff', background: '#a78bfa', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Voir tout
          </button>
        </div>
      )}

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
  const hookText = post.hook || post.title
  const color = pillar?.color ?? '#666'

  return (
    <div
      draggable
      onDragStart={() => onDragStart(post.id)}
      onClick={onClick}
      style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 8, padding: '10px 12px', cursor: 'grab',
        display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'all 0.1s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-primary)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {pillar?.name ?? '—'}
        </span>
        <Icon size={11} color="var(--text-tertiary)" />
      </div>
      {hookText ? (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {hookText}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          + Cliquer pour ajouter accroche
        </div>
      )}
      {post.plan_date && (
        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>
          {formatDate(post.plan_date)}
        </div>
      )}
    </div>
  )
}

function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string; color?: string }[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = options.find((o) => o.value === value) ?? options[0]
  const isFiltered = value !== 'all' && value !== options[0]?.value

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          color: isFiltered ? '#a78bfa' : 'var(--text-secondary)',
          background: isFiltered ? 'rgba(167,139,250,0.1)' : 'var(--bg-secondary)',
          border: `1px solid ${isFiltered ? 'rgba(167,139,250,0.4)' : 'var(--border-primary)'}`,
          borderRadius: 8, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {current?.color && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: current.color }} />
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}:
        </span>
        <span>{current?.label}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          minWidth: 180, maxHeight: 320, overflowY: 'auto',
          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: 10, padding: 4,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          zIndex: 30,
        }}>
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '7px 10px',
                  background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color }} />}
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.label}</span>
                {active && <Check size={13} color="#a78bfa" />}
              </button>
            )
          })}
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
