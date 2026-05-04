'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  ContentPillar,
  SocialPostWithPublications,
  SocialProductionStatus,
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
  idea: 0.25, to_film: 0.4, filmed: 0.6, edited: 0.8, ready: 1,
}

export default function PlanningCalendarView({ posts, pillars, cursor, onCursorChange, onSelectSlot }: Props) {
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month - 1, 1)
    const startOffset = (first.getDay() + 6) % 7
    const gridStart = new Date(cursor.year, cursor.month - 1, 1 - startOffset)
    const days: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      days.push({ date: d, inMonth: d.getMonth() === cursor.month - 1 })
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
    return map
  }, [posts])

  const navigate = (delta: number) => {
    const m = cursor.month + delta
    if (m < 1) onCursorChange({ year: cursor.year - 1, month: 12 })
    else if (m > 12) onCursorChange({ year: cursor.year + 1, month: 1 })
    else onCursorChange({ year: cursor.year, month: m })
  }

  return (
    <div>
      {/* Header navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={navBtnStyle}><ChevronLeft size={16} /></button>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', minWidth: 160 }}>
          {MONTHS[cursor.month - 1]} {cursor.year}
        </h3>
        <button onClick={() => navigate(1)} style={navBtnStyle}><ChevronRight size={16} /></button>
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
        {cells.map((c, i) => {
          const dateKey = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}-${String(c.date.getDate()).padStart(2, '0')}`
          const dayPosts = postsByDate.get(dateKey) ?? []
          const stories = dayPosts.filter((p) => p.content_kind === 'story')
          const postsOfDay = dayPosts.filter((p) => p.content_kind === 'post')
          const storiesReady = stories.filter((p) => p.production_status === 'ready' || p.status !== 'draft').length
          const postsReady = postsOfDay.filter((p) => p.production_status === 'ready' || p.status !== 'draft').length

          return (
            <div
              key={i}
              style={{
                minHeight: 110, padding: 8,
                background: c.inMonth ? 'var(--bg-secondary)' : 'transparent',
                border: '1px solid var(--border-primary)', borderRadius: 8,
                opacity: c.inMonth ? 1 : 0.4,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {c.date.getDate()}
              </div>
              {dayPosts.length > 0 && (
                <>
                  {postsOfDay.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      📰 {postsReady}/{postsOfDay.length}
                    </div>
                  )}
                  {stories.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      📱 {storiesReady}/{stories.length}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {dayPosts.slice(0, 8).map((p) => {
                      const pillar = pillars.find((x) => x.id === p.pillar_id)
                      const op = STATUS_OPACITY[(p.production_status ?? 'idea') as SocialProductionStatus]
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSelectSlot(p.id)}
                          title={`${pillar?.name ?? ''} — ${p.production_status ?? 'idea'}`}
                          style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: pillar?.color ?? '#666',
                            opacity: p.status === 'published' ? 0.5 : op,
                            border: p.status === 'published' ? '1.5px solid #10b981' : 'none',
                            cursor: 'pointer', padding: 0,
                          }}
                        />
                      )
                    })}
                    {dayPosts.length > 8 && (
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{dayPosts.length - 8}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
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
