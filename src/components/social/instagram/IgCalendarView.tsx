'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { IgDraft } from '@/types'
import IgDraftModal from './IgDraftModal'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const STATUS_COLORS: Record<string, string> = {
  published: '#22c55e', scheduled: '#3b82f6', draft: '#666', failed: '#ef4444', publishing: '#f97316',
}

export default function IgCalendarView() {
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [drafts, setDrafts] = useState<IgDraft[]>([])
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<IgDraft | null>(null)

  const fetchDrafts = useCallback(async () => {
    const res = await fetch('/api/instagram/drafts?per_page=100')
    const json = await res.json()
    setDrafts(json.data ?? [])
  }, [])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday = 0
  const totalDays = lastDay.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return drafts.filter(d => {
      const dDate = (d.scheduled_at || d.published_at || d.created_at).slice(0, 10)
      return dDate === dateStr
    })
  }

  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><ChevronLeft size={20} /></button>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', minWidth: 180, textAlign: 'center' }}>{monthLabel}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><ChevronRight size={20} /></button>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 100, background: 'var(--bg-primary)', borderRadius: 4 }} />
          const events = getEventsForDay(day)
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === new Date().toISOString().slice(0, 10)
          return (
            <div
              key={i}
              onClick={() => setModalDate(dateStr)}
              style={{
                minHeight: 100, padding: 6, background: 'var(--bg-secondary)',
                borderRadius: 4, cursor: 'pointer',
                border: isToday ? '1px solid var(--color-primary)' : '1px solid var(--border-primary)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--color-primary)' : 'var(--text-secondary)', marginBottom: 4 }}>{day}</div>
              {events.slice(0, 3).map(ev => (
                <div
                  key={ev.id}
                  onClick={e => { e.stopPropagation(); setEditDraft(ev) }}
                  style={{
                    padding: '2px 6px', fontSize: 10, marginBottom: 2, borderRadius: 4,
                    background: (STATUS_COLORS[ev.status] ?? '#666') + '22',
                    color: STATUS_COLORS[ev.status] ?? '#666',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  {ev.caption?.slice(0, 20) || ev.status}
                </div>
              ))}
              {events.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>+{events.length - 3} autres</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {[
          { label: 'Publie', color: '#22c55e' },
          { label: 'Programme', color: '#3b82f6' },
          { label: 'Brouillon', color: '#666' },
          { label: 'Echoue', color: '#ef4444' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Draft modal */}
      {(modalDate || editDraft) && (
        <IgDraftModal
          date={modalDate ?? undefined}
          draft={editDraft ?? undefined}
          onClose={() => { setModalDate(null); setEditDraft(null) }}
          onSaved={() => { setModalDate(null); setEditDraft(null); fetchDrafts() }}
        />
      )}
    </div>
  )
}
