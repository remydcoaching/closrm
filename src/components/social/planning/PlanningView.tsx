'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Sparkles, KanbanSquare, Calendar as CalIcon } from 'lucide-react'
import type { ContentPillar, ContentTrame, SocialPostWithPublications } from '@/types'
import TrameEditorModal from './TrameEditorModal'
import BoardView from './BoardView'
import PlanningCalendarView from './PlanningCalendarView'
import SlotDetailDrawer from './SlotDetailDrawer'

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function PlanningView() {
  const [view, setView] = useState<'calendar' | 'board'>('board')
  const [trame, setTrame] = useState<ContentTrame | null>(null)
  const [generations, setGenerations] = useState<{ year: number; month: number; slots_created: number }[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [posts, setPosts] = useState<SocialPostWithPublications[]>([])
  const [loading, setLoading] = useState(true)
  const [trameModalOpen, setTrameModalOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const targetMonth = (() => {
    const m = cursor.month + 1
    return m > 12 ? { year: cursor.year + 1, month: 1 } : { year: cursor.year, month: m }
  })()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [trameRes, pillarsRes, postsRes] = await Promise.all([
        fetch('/api/social/trame'),
        fetch('/api/social/pillars'),
        fetch(buildPostsUrl(cursor)),
      ])
      const trameJson = await trameRes.json()
      const pillarsJson = await pillarsRes.json()
      const postsJson = await postsRes.json()
      setTrame(trameJson.data ?? null)
      setGenerations(trameJson.generations ?? [])
      setPillars(pillarsJson.data ?? [])
      setPosts(postsJson.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [cursor])

  useEffect(() => { reload() }, [reload])

  const targetMonthLabel = `${MONTHS_FR[targetMonth.month - 1]} ${targetMonth.year}`
  const alreadyGenerated = generations.some(
    (g) => g.year === targetMonth.year && g.month === targetMonth.month
  )

  const handleGenerate = async (force = false) => {
    if (!trame) {
      setTrameModalOpen(true)
      return
    }
    if (alreadyGenerated && !force) return
    setGenerating(true)
    try {
      const res = await fetch('/api/social/trame/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetMonth),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur génération')
      const { slots_created, slots_skipped } = json.data
      alert(`✓ ${slots_created} slots créés (${slots_skipped ?? 0} déjà existants) pour ${targetMonthLabel}`)
      await reload()
    } catch (e) {
      alert(`Erreur: ${(e as Error).message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10, border: '1px solid var(--border-primary)' }}>
          <button
            onClick={() => setView('board')}
            style={tabBtnStyle(view === 'board')}
          >
            <KanbanSquare size={14} /> Board
          </button>
          <button
            onClick={() => setView('calendar')}
            style={tabBtnStyle(view === 'calendar')}
          >
            <CalIcon size={14} /> Calendrier
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setTrameModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <Settings size={14} /> Trame
          </button>
          <button
            onClick={() => handleGenerate(alreadyGenerated)}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff',
              background: alreadyGenerated ? '#666' : '#a78bfa',
              border: 'none', borderRadius: 8,
              cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            <Sparkles size={14} />
            {generating
              ? 'Génération…'
              : alreadyGenerated
                ? `Régénérer ${targetMonthLabel}`
                : `Générer ${targetMonthLabel}`}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Chargement…
        </div>
      ) : !trame ? (
        <EmptyTrame onCreate={() => setTrameModalOpen(true)} />
      ) : view === 'board' ? (
        <BoardView
          posts={posts}
          pillars={pillars}
          onSelectSlot={setSelectedSlotId}
          onChange={reload}
        />
      ) : (
        <PlanningCalendarView
          posts={posts}
          pillars={pillars}
          cursor={cursor}
          onCursorChange={setCursor}
          onSelectSlot={setSelectedSlotId}
        />
      )}

      {trameModalOpen && (
        <TrameEditorModal
          trame={trame}
          pillars={pillars}
          onClose={() => setTrameModalOpen(false)}
          onSaved={() => { setTrameModalOpen(false); reload() }}
        />
      )}

      {selectedSlotId && (
        <SlotDetailDrawer
          slotId={selectedSlotId}
          pillars={pillars}
          onClose={() => setSelectedSlotId(null)}
          onChange={reload}
        />
      )}
    </div>
  )
}

function buildPostsUrl(cursor: { year: number; month: number }) {
  const from = new Date(cursor.year, cursor.month - 2, 1)
  const to = new Date(cursor.year, cursor.month + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `/api/social/posts?plan_date_from=${fmt(from)}&plan_date_to=${fmt(to)}&per_page=500`
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', fontSize: 12, fontWeight: 600,
    color: active ? '#fff' : 'var(--text-tertiary)',
    background: active ? '#a78bfa' : 'transparent',
    border: 'none', borderRadius: 6,
    cursor: 'pointer',
  }
}

function EmptyTrame({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: 80, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px dashed var(--border-primary)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        Pas encore de trame
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
        Définis ta trame de contenu hebdomadaire (stories quotidiennes + posts) pour pouvoir générer automatiquement les slots du mois.
      </p>
      <button
        onClick={onCreate}
        style={{
          padding: '10px 20px', fontSize: 13, fontWeight: 600,
          color: '#fff', background: '#a78bfa',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}
      >
        Créer ma trame
      </button>
    </div>
  )
}
