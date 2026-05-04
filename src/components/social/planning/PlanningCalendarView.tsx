'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Camera, FileText, Film, X, Check, Lightbulb, Clapperboard, Scissors, Sparkles, CheckCircle2 } from 'lucide-react'
import type {
  ContentPillar,
  SocialPostWithPublications,
  SocialProductionStatus,
  SocialContentKind,
} from '@/types'

interface Props {
  posts: SocialPostWithPublications[]
  pillars: ContentPillar[]
  cursor: { year: number; month: number }
  onCursorChange: (c: { year: number; month: number }) => void
  onSelectSlot: (id: string) => void
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const STATUS_OPACITY: Record<SocialProductionStatus, number> = {
  idea: 0.5, to_film: 0.65, filmed: 0.8, edited: 0.9, ready: 1,
}
const STATUS_META: Record<SocialProductionStatus, { icon: typeof Camera; color: string; label: string }> = {
  idea:    { icon: Lightbulb,    color: '#94a3b8', label: 'Idée' },
  to_film: { icon: Clapperboard, color: '#f59e0b', label: 'À filmer' },
  filmed:  { icon: Camera,       color: '#06b6d4', label: 'Filmé' },
  edited:  { icon: Scissors,     color: '#8b5cf6', label: 'Monté' },
  ready:   { icon: Sparkles,     color: '#10b981', label: 'Prêt' },
}
const KIND_ICON: Record<SocialContentKind, typeof Camera> = {
  post: FileText, story: Camera, reel: Film,
}

const MAX_VISIBLE_PER_CELL = 4

export default function PlanningCalendarView({ posts, pillars, cursor, onCursorChange, onSelectSlot }: Props) {
  const [dayPopover, setDayPopover] = useState<string | null>(null)

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1)
    const startOffset = (first.getDay() + 6) % 7
    const gridStart = new Date(cursor.year, cursor.month - 1, 1 - startOffset)
    const days: { date: Date; inMonth: boolean; key: string }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push({ date: d, inMonth: d.getMonth() === cursor.month - 1, key })
    }
    return days
  }, [cursor])

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPostWithPublications[]>()
    for (const p of posts) {
      const key = p.plan_date ?? (p.scheduled_at ? p.scheduled_at.slice(0, 10) : null)
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    // Sort each day: posts first, then stories; by slot_index
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.content_kind !== b.content_kind) {
          if (a.content_kind === 'post') return -1
          if (b.content_kind === 'post') return 1
        }
        return (a.slot_index ?? 99) - (b.slot_index ?? 99)
      })
    }
    return map
  }, [posts])

  const navigate = (delta: number) => {
    const m = cursor.month + delta
    if (m < 1) onCursorChange({ year: cursor.year - 1, month: 12 })
    else if (m > 12) onCursorChange({ year: cursor.year + 1, month: 1 })
    else onCursorChange({ year: cursor.year, month: m })
  }

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => navigate(-1)} style={navBtnStyle}><ChevronLeft size={16} /></button>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160 }}>
          {MONTHS[cursor.month - 1]} {cursor.year}
        </h3>
        <button onClick={() => navigate(1)} style={navBtnStyle}><ChevronRight size={16} /></button>
        <button
          onClick={() => onCursorChange({ year: today.getFullYear(), month: today.getMonth() + 1 })}
          style={{ marginLeft: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer' }}
        >Aujourd'hui</button>
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 12px', marginBottom: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>État :</span>
        {(Object.entries(STATUS_META) as [SocialProductionStatus, typeof STATUS_META.idea][]).map(([key, meta]) => {
          const Icon = meta.icon
          return (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
              <Icon size={10} color={meta.color} />
              {meta.label}
            </span>
          )
        })}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
          <CheckCircle2 size={10} color="#10b981" />
          Publié
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 5px #a78bfa' }} />
          Programmé
        </span>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center', padding: 6 }}>
            {wd}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((c) => {
          const dayPosts = postsByDate.get(c.key) ?? []
          const posts = dayPosts.filter((p) => p.content_kind !== 'story')
          const stories = dayPosts.filter((p) => p.content_kind === 'story')
          const isToday = c.key === todayKey
          const visiblePosts = posts.slice(0, MAX_VISIBLE_PER_CELL)
          const overflowPosts = posts.length - visiblePosts.length

          return (
            <div
              key={c.key}
              style={{
                position: 'relative',
                minHeight: 96, padding: 6,
                background: isToday ? 'rgba(167,139,250,0.06)' : (c.inMonth ? 'var(--bg-secondary)' : 'transparent'),
                border: isToday ? '1px solid rgba(167,139,250,0.4)' : '1px solid var(--border-primary)',
                borderRadius: 8,
                opacity: c.inMonth ? 1 : 0.4,
                display: 'flex', flexDirection: 'column', gap: 3,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#a78bfa' : 'var(--text-secondary)' }}>
                  {c.date.getDate()}
                </span>
                {(posts.length + stories.length) > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', gap: 4 }}>
                    {posts.length > 0 && <span>{posts.length}P</span>}
                    {stories.length > 0 && <span style={{ color: '#ec4899' }}>{stories.length}S</span>}
                  </span>
                )}
              </div>

              {/* Posts — full chips with status indicator */}
              {visiblePosts.map((p) => {
                const pillar = pillars.find((x) => x.id === p.pillar_id)
                const prodStatus = (p.production_status ?? 'idea') as SocialProductionStatus
                const meta = STATUS_META[prodStatus]
                const op = STATUS_OPACITY[prodStatus]
                const isPublished = p.status === 'published'
                const isScheduled = p.status === 'scheduled'
                const isFailed = p.status === 'failed'
                const color = pillar?.color ?? '#666'
                const StatusIcon = isPublished ? CheckCircle2 : meta.icon
                const statusColor = isPublished ? '#10b981' : isFailed ? '#ef4444' : meta.color
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectSlot(p.id)}
                    title={`${pillar?.name ?? '—'} · ${isPublished ? 'Publié' : isScheduled ? 'Programmé' : meta.label}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 6px',
                      background: color + (isPublished ? '12' : '20'),
                      border: `1px solid ${color}${isPublished ? '35' : '50'}`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 4, cursor: 'pointer',
                      opacity: isPublished ? 0.75 : op,
                      width: '100%', overflow: 'hidden',
                      transition: 'all 0.1s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
                  >
                    <StatusIcon size={10} color={statusColor} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', textDecoration: isPublished ? 'line-through' : 'none' }}>
                      {pillar?.name ?? '—'}
                    </span>
                    {isScheduled && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 5px #a78bfa' }} />
                    )}
                    {isFailed && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#ef4444' }}>!</span>
                    )}
                  </button>
                )
              })}

              {overflowPosts > 0 && (
                <button
                  onClick={() => setDayPopover(c.key)}
                  style={{
                    fontSize: 10, fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px 4px', textAlign: 'left',
                  }}
                >
                  +{overflowPosts} post{overflowPosts > 1 ? 's' : ''}…
                </button>
              )}

              {/* Stories — pastilles compactes en bas */}
              {stories.length > 0 && (
                <button
                  onClick={() => setDayPopover(c.key)}
                  title={`${stories.length} stor${stories.length > 1 ? 'ies' : 'y'}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    marginTop: 'auto', padding: '3px 4px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    flexWrap: 'wrap',
                  }}
                >
                  <Camera size={9} color="#ec4899" style={{ flexShrink: 0 }} />
                  {stories.slice(0, 6).map((s) => {
                    const pillar = pillars.find((x) => x.id === s.pillar_id)
                    const op = STATUS_OPACITY[(s.production_status ?? 'idea') as SocialProductionStatus]
                    return (
                      <span
                        key={s.id}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: pillar?.color ?? '#666', opacity: op, flexShrink: 0 }}
                      />
                    )
                  })}
                  {stories.length > 6 && <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>+{stories.length - 6}</span>}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Day popover */}
      {dayPopover && (
        <DayPopover
          dateKey={dayPopover}
          posts={postsByDate.get(dayPopover) ?? []}
          pillars={pillars}
          onClose={() => setDayPopover(null)}
          onSelectSlot={(id) => { setDayPopover(null); onSelectSlot(id) }}
        />
      )}
    </div>
  )
}

function DayPopover({ dateKey, posts, pillars, onClose, onSelectSlot }: {
  dateKey: string
  posts: SocialPostWithPublications[]
  pillars: ContentPillar[]
  onClose: () => void
  onSelectSlot: (id: string) => void
}) {
  const date = new Date(dateKey + 'T00:00:00')
  const label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 92vw)', maxHeight: '80vh',
          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-primary)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{label}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {posts.map((p) => {
            const pillar = pillars.find((x) => x.id === p.pillar_id)
            const Icon = KIND_ICON[(p.content_kind ?? 'post') as SocialContentKind]
            return (
              <button
                key={p.id}
                onClick={() => onSelectSlot(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  borderLeft: `3px solid ${pillar?.color ?? '#666'}`,
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8, cursor: 'pointer',
                  marginBottom: 4,
                  textAlign: 'left',
                }}
              >
                <Icon size={14} color={pillar?.color ?? 'var(--text-tertiary)'} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: pillar?.color ?? 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    {pillar?.name ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.hook || p.title || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>(sans accroche)</span>}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  {p.production_status ?? 'idea'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
  borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer',
}
