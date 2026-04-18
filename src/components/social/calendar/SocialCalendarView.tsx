'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Camera, Video, Calendar as CalIcon } from 'lucide-react'
import type { SocialPost, SocialPostPublication, SocialPlatform } from '@/types'
import PostComposer from './PostComposer'

interface PostWithPubs extends SocialPost {
  publications: SocialPostPublication[]
}

const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; icon: typeof Camera }> = {
  instagram: { label: 'IG', color: '#EC4899', icon: Camera },
  youtube:   { label: 'YT', color: '#FF0000', icon: Video },
  tiktok:    { label: 'TT', color: '#000000', icon: Video },
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function SocialCalendarView() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [posts, setPosts] = useState<PostWithPubs[]>([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerDefaultDate, setComposerDefaultDate] = useState<Date | null>(null)
  const [editingPost, setEditingPost] = useState<PostWithPubs | null>(null)

  const monthStart = useMemo(() => new Date(cursor.year, cursor.month, 1), [cursor])
  const monthEnd = useMemo(() => new Date(cursor.year, cursor.month + 1, 0), [cursor])

  const reload = async () => {
    setLoading(true)
    try {
      const from = new Date(cursor.year, cursor.month - 1, 1).toISOString()
      const to = new Date(cursor.year, cursor.month + 2, 0).toISOString()
      const res = await fetch(`/api/social/posts?from=${from}&to=${to}&per_page=100`)
      const json = await res.json()
      setPosts(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [cursor.year, cursor.month])

  // Build calendar grid (6 rows × 7 cols, Monday-first)
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    // Monday-first: getDay() = 0 (Sun) ... 6 (Sat) → shift so Mon=0
    const startOffset = (first.getDay() + 6) % 7
    const gridStart = new Date(cursor.year, cursor.month, 1 - startOffset)
    const days: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      days.push({ date: d, inMonth: d.getMonth() === cursor.month })
    }
    return days
  }, [cursor])

  const postsByDay = useMemo(() => {
    const map: Record<string, PostWithPubs[]> = {}
    for (const p of posts) {
      if (!p.scheduled_at && !p.published_at) continue
      const key = (p.scheduled_at ?? p.published_at)!.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return map
  }, [posts])

  const nav = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const openComposer = (date?: Date) => {
    setComposerDefaultDate(date ?? new Date())
    setEditingPost(null)
    setComposerOpen(true)
  }

  const openEditor = (post: PostWithPubs) => {
    setEditingPost(post)
    setComposerDefaultDate(null)
    setComposerOpen(true)
  }

  const todayKey = new Date().toISOString().slice(0, 10)

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => nav(-1)} style={navBtn}><ChevronLeft size={15} /></button>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', minWidth: 200 }}>
            {MONTHS[cursor.month]} {cursor.year}
          </div>
          <button onClick={() => nav(1)} style={navBtn}><ChevronRight size={15} /></button>
          <button
            onClick={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              background: 'transparent', border: '1px solid var(--border-primary)',
              borderRadius: 7, color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>
        <button
          onClick={() => openComposer()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            color: '#fff', background: '#5b9bf5', border: 'none', borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          Nouveau post
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#EC4899' }} /> Instagram
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FF0000' }} /> YouTube
        </span>
      </div>

      {/* Weekday header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, marginBottom: 2,
      }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{
            padding: '8px 10px', fontSize: 10, fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {cells.map(({ date, inMonth }, i) => {
          const key = date.toISOString().slice(0, 10)
          const dayPosts = postsByDay[key] ?? []
          const isToday = key === todayKey
          return (
            <div
              key={i}
              onClick={() => openComposer(date)}
              style={{
                background: inMonth ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                minHeight: 110,
                padding: 6,
                cursor: 'pointer',
                opacity: inMonth ? 1 : 0.4,
                position: 'relative',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = inMonth ? 'var(--bg-hover)' : 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = inMonth ? 'var(--bg-surface)' : 'var(--bg-elevated)')}
            >
              <div style={{
                fontSize: 11, fontWeight: isToday ? 700 : 500,
                color: isToday ? '#5b9bf5' : 'var(--text-secondary)',
                marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{date.getDate()}</span>
                {isToday && (
                  <span style={{ fontSize: 9, background: '#5b9bf5', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>TODAY</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {dayPosts.slice(0, 3).map((p) => (
                  <PostCard key={p.id} post={p} onClick={(e) => { e.stopPropagation(); openEditor(p) }} />
                ))}
                {dayPosts.length > 3 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>
                    +{dayPosts.length - 3} autre{dayPosts.length - 3 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>
          Chargement…
        </div>
      )}

      {composerOpen && (
        <PostComposer
          defaultDate={composerDefaultDate}
          editingPost={editingPost}
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PostCard({ post, onClick }: { post: PostWithPubs; onClick: (e: React.MouseEvent) => void }) {
  const title = post.title ?? post.caption?.slice(0, 40) ?? '(sans titre)'
  const statusColor = post.status === 'published' ? '#38A169'
    : post.status === 'failed' ? '#E53E3E'
    : post.status === 'partial' ? '#D69E2E'
    : post.status === 'publishing' ? '#5b9bf5'
    : 'var(--text-muted)'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '4px 6px', borderRadius: 4,
        background: 'var(--bg-elevated)',
        border: `1px solid var(--border-primary)`,
        borderLeft: `3px solid ${statusColor}`,
        fontSize: 10, cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3,
        marginBottom: 1,
      }}>
        {post.publications.map((pub) => {
          const meta = PLATFORM_META[pub.platform]
          return (
            <span
              key={pub.id}
              title={meta.label}
              style={{
                display: 'inline-flex', alignItems: 'center',
                width: 14, height: 14, borderRadius: 3,
                background: `${meta.color}33`,
                color: meta.color,
                justifyContent: 'center',
              }}
            >
              <meta.icon size={9} />
            </span>
          )
        })}
      </div>
      <div style={{
        color: 'var(--text-primary)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      {post.scheduled_at && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          {new Date(post.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7,
  background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
  color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
