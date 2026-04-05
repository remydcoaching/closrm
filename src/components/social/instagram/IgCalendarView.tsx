'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Trash2, AlertTriangle } from 'lucide-react'
import type { IgDraft } from '@/types'
import IgDraftModal from './IgDraftModal'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const STATUS_COLORS: Record<string, string> = {
  published: '#22c55e', scheduled: '#3b82f6', draft: '#666', failed: '#ef4444', publishing: '#f97316',
}

const MAX_VISIBLE = 3
const CELL_EXPANDED_MAX_HEIGHT = 280

export default function IgCalendarView() {
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [drafts, setDrafts] = useState<IgDraft[]>([])
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<IgDraft | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cleaningErrors, setCleaningErrors] = useState(false)

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/drafts?per_page=100')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setDrafts(json.data ?? [])
    } catch {
      // silently fail — calendar still renders empty
    }
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

  // Expand/collapse day
  const toggleExpandDay = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  // Delete a single draft
  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Supprimer ce brouillon ?')) return
    setDeletingId(draftId)
    try {
      const res = await fetch(`/api/instagram/drafts/${draftId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await fetchDrafts()
    } catch {
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  // Delete all failed drafts
  const failedDrafts = drafts.filter(d => d.status === 'failed')

  const handleCleanErrors = async () => {
    if (failedDrafts.length === 0) return
    if (!confirm(`Supprimer les ${failedDrafts.length} brouillon${failedDrafts.length > 1 ? 's' : ''} en erreur ?`)) return
    setCleaningErrors(true)
    try {
      const results = await Promise.allSettled(
        failedDrafts.map(d => fetch(`/api/instagram/drafts/${d.id}`, { method: 'DELETE' }))
      )
      const failures = results.filter(r => r.status === 'rejected').length
      if (failures > 0) alert(`${failures} suppression(s) ont echoue`)
      await fetchDrafts()
    } catch {
      alert('Erreur lors du nettoyage')
    } finally {
      setCleaningErrors(false)
    }
  }

  // Modal handlers — clear the other state to avoid confusion
  const openDateModal = (dateStr: string) => {
    setEditDraft(null)
    setModalDate(dateStr)
  }

  const openEditModal = (draft: IgDraft) => {
    setModalDate(null)
    setEditDraft(draft)
  }

  const closeModal = () => {
    setModalDate(null)
    setEditDraft(null)
  }

  return (
    <div>
      {/* Month navigation + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={prevMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-tertiary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
          ><ChevronLeft size={18} /></button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', minWidth: 200, textAlign: 'center' }}>{monthLabel}</span>
          <button onClick={nextMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-tertiary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
          ><ChevronRight size={18} /></button>
        </div>

        {failedDrafts.length > 0 && (
          <button
            onClick={handleCleanErrors}
            disabled={cleaningErrors}
            style={{
              padding: '7px 14px', fontSize: 11, fontWeight: 600,
              color: '#ef4444', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
              cursor: cleaningErrors ? 'wait' : 'pointer',
              opacity: cleaningErrors ? 0.6 : 1,
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={e => { if (!cleaningErrors) { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
          >
            <AlertTriangle size={13} />
            {cleaningErrors ? 'Nettoyage...' : `Nettoyer les erreurs (${failedDrafts.length})`}
          </button>
        )}
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 115, background: 'var(--bg-primary)', borderRadius: 8, opacity: 0.4 }} />
          const events = getEventsForDay(day)
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === new Date().toISOString().slice(0, 10)
          const isExpanded = expandedDays.has(dateStr)
          const visibleEvents = isExpanded ? events : events.slice(0, MAX_VISIBLE)
          const hasOverflow = events.length > MAX_VISIBLE

          return (
            <div
              key={i}
              onClick={() => openDateModal(dateStr)}
              style={{
                minHeight: 115,
                maxHeight: isExpanded ? CELL_EXPANDED_MAX_HEIGHT : undefined,
                padding: 8,
                background: isToday ? 'rgba(229,62,62,0.06)' : 'var(--bg-secondary)',
                borderRadius: 8, cursor: 'pointer',
                border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--border-primary)',
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.borderColor = 'var(--text-tertiary)'; e.currentTarget.style.background = isToday ? 'rgba(229,62,62,0.1)' : 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.background = isToday ? 'rgba(229,62,62,0.06)' : 'var(--bg-secondary)' }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--color-primary)' : 'var(--text-secondary)', marginBottom: 6, flexShrink: 0 }}>
                {isToday ? (
                  <span style={{ background: 'var(--color-primary)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{day}</span>
                ) : day}
              </div>
              <div style={{
                flex: 1,
                overflowY: isExpanded ? 'auto' : 'hidden',
                minHeight: 0,
              }}>
                {visibleEvents.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '3px 7px', fontSize: 10, fontWeight: 500, marginBottom: 3, borderRadius: 4,
                      background: (STATUS_COLORS[ev.status] ?? '#666') + '22',
                      color: STATUS_COLORS[ev.status] ?? '#666',
                      borderLeft: `3px solid ${STATUS_COLORS[ev.status] ?? '#666'}`,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer', transition: 'opacity 0.15s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                    }}
                  >
                    <span
                      onClick={e => { e.stopPropagation(); openEditModal(ev) }}
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                    >
                      {ev.caption?.slice(0, 20) || ev.status}
                    </span>
                    <button
                      onClick={e => handleDeleteDraft(ev.id, e)}
                      disabled={deletingId === ev.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'inherit', padding: 0, lineHeight: 1,
                        opacity: deletingId === ev.id ? 0.4 : 0.5,
                        transition: 'opacity 0.15s ease',
                        flexShrink: 0, display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
              {hasOverflow && (
                <button
                  onClick={e => toggleExpandDay(dateStr, e)}
                  style={{
                    fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    textAlign: 'left', transition: 'color 0.15s ease', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                >
                  {isExpanded ? 'Voir moins' : `+${events.length - MAX_VISIBLE} autres`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Publié', color: '#22c55e' },
          { label: 'Programmé', color: '#3b82f6' },
          { label: 'Brouillon', color: '#666' },
          { label: 'En cours', color: '#f97316' },
          { label: 'Échoué', color: '#ef4444' },
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
          onClose={closeModal}
          onSaved={() => { closeModal(); fetchDrafts() }}
        />
      )}
    </div>
  )
}
