'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { KanbanSquare, Calendar as CalIcon, Plus, CalendarRange } from 'lucide-react'
import type { ContentPillar, ContentTrame, SocialPostWithPublications } from '@/types'
import BoardView from './BoardView'
import PlanningCalendarView from './PlanningCalendarView'
import { useToast } from '@/components/ui/Toast'

// Modals + drawer : conditionnel et lourd → import dynamique pour alléger le bundle initial
const SlotDetailDrawer = dynamic(() => import('./SlotDetailDrawer'), { ssr: false })
const TrameEditorModal = dynamic(() => import('./TrameEditorModal'), { ssr: false })
const PlanModal = dynamic(() => import('./PlanModal'), { ssr: false })


export default function PlanningView() {
  const toast = useToast()
  // Always start with 'calendar' to match SSR. Hydrate from localStorage after mount
  // to avoid hydration mismatch (server can't read localStorage).
  const [view, setView] = useState<'calendar' | 'board'>('calendar')
  useEffect(() => {
    const stored = window.localStorage.getItem('social_planning_view_mode')
    if (stored === 'board') setView('board')
  }, [])
  const [trame, setTrame] = useState<ContentTrame | null>(null)
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [posts, setPosts] = useState<SocialPostWithPublications[]>([])
  const [structureLoading, setStructureLoading] = useState(true) // trame + pillars
  const [postsLoading, setPostsLoading] = useState(true)
  const [trameModalOpen, setTrameModalOpen] = useState(false)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const reloadStructure = useCallback(async () => {
    setStructureLoading(true)
    try {
      const [trameRes, pillarsRes] = await Promise.all([
        fetch('/api/social/trame'),
        fetch('/api/social/pillars'),
      ])
      const trameJson = await trameRes.json()
      const pillarsJson = await pillarsRes.json()
      setTrame(trameJson.data ?? null)
      setPillars(pillarsJson.data ?? [])
    } finally {
      setStructureLoading(false)
    }
  }, [])

  // `silent` skip le spinner — utilisé après un PATCH (drag-drop, edit slot)
  // pour ne pas faire flicker la grille
  const reloadPosts = useCallback(async (silent = false) => {
    if (!silent) setPostsLoading(true)
    try {
      const res = await fetch(buildPostsUrl(cursor))
      const json = await res.json()
      setPosts(json.data ?? [])
    } finally {
      if (!silent) setPostsLoading(false)
    }
  }, [cursor])

  // Reload light (juste posts en silence) pour drag-drop / edit slot.
  // L'éditeur de trame ou la création de pillars utilisent reloadStructure
  // séparément quand nécessaire.
  const reloadSilent = useCallback(async () => {
    await reloadPosts(true)
  }, [reloadPosts])

  // Reload complet (trame + pillars + posts) — utilisé quand la trame change
  const reload = useCallback(async () => {
    await Promise.all([reloadStructure(), reloadPosts()])
  }, [reloadStructure, reloadPosts])

  useEffect(() => { reloadStructure() }, [reloadStructure])
  useEffect(() => { reloadPosts() }, [reloadPosts])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('social_planning_view_mode', view)
    }
  }, [view])

  const createPost = async (planDate?: string) => {
    const fallback = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    const res = await fetch('/api/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_kind: 'post',
        production_status: 'idea',
        status: 'draft',
        plan_date: planDate ?? fallback,
        publications: [],
      }),
    })
    const json = await res.json()
    if (res.ok && json.data?.id) {
      setSelectedSlotId(json.data.id)
      reload()
    } else {
      const errMsg = typeof json.error === 'string'
        ? json.error
        : json.error?.formErrors?.join(', ')
          || Object.values(json.error?.fieldErrors ?? {}).flat().join(', ')
          || 'inconnue'
      toast.error('Erreur création slot', errMsg)
    }
  }

  const planRange = async ({ kinds, start_date, end_date }: { kinds: ('post' | 'story')[]; start_date: string; end_date: string }) => {
    if (!trame) {
      setTrameModalOpen(true)
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/social/trame/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kinds,
          window: 'range',
          start_date,
          end_date,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      const { slots_created, slots_skipped } = json.data
      toast.success(`${slots_created} slots créés`, slots_skipped ? `${slots_skipped} déjà existants ignorés` : undefined)
      setPlanModalOpen(false)
      await reload()
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
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
            onClick={() => setView('calendar')}
            style={tabBtnStyle(view === 'calendar')}
          >
            <CalIcon size={14} /> Calendrier
          </button>
          <button
            onClick={() => setView('board')}
            style={tabBtnStyle(view === 'board')}
          >
            <KanbanSquare size={14} /> Board
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => createPost(undefined)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff', background: '#5b9bf5',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Nouveau post
          </button>
          <button
            onClick={() => setPlanModalOpen(true)}
            disabled={generating}
            title="Préparer des slots vides à partir de la trame (la trame est éditable depuis ce bouton)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff',
              background: '#a78bfa',
              border: 'none', borderRadius: 8,
              cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            <CalendarRange size={13} />
            {generating ? '…' : 'Générer slots'}
          </button>
        </div>
      </div>

      {/* Content */}
      {structureLoading ? (
        <SkeletonBoard />
      ) : !trame ? (
        <EmptyTrame onCreate={() => setTrameModalOpen(true)} />
      ) : (
        <>
          {postsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, border: '2px solid #a78bfa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Chargement des slots…
            </div>
          )}
          {view === 'board' ? (
            <BoardView
              posts={posts}
              pillars={pillars}
              onSelectSlot={setSelectedSlotId}
              onChange={reloadSilent}
              onLocalMove={(id, status) => {
                setPosts(prev => prev.map(p => p.id === id ? { ...p, production_status: status } : p))
              }}
            />
          ) : (
            <PlanningCalendarView
              posts={posts}
              pillars={pillars}
              cursor={cursor}
              onCursorChange={setCursor}
              onSelectSlot={setSelectedSlotId}
              onCreateSlot={createPost}
              onMoveSlot={async (slotId, newDate) => {
                // Optimistic update: on patch UNIQUEMENT le slot deplace
                // (pas tout l'array). Sans ca, drag-rapide D1 + D2 en
                // simultane, si D1 fail apres D2, le revert restaurait
                // l'array d'avant D1 et ecrasait D2.
                const moved = posts.find(p => p.id === slotId)
                if (!moved) return
                const oldDate = moved.plan_date?.slice(0, 10) ?? null
                if (oldDate === newDate) return // no-op, meme cellule
                // Snapshot de l'etat avant move (just le slot, pas tout)
                const previousSnapshot: Partial<SocialPostWithPublications> = {
                  plan_date: moved.plan_date,
                  slot_index: moved.slot_index,
                  scheduled_at: moved.scheduled_at,
                }
                let newScheduledAt: string | null = null
                if (moved.scheduled_at) {
                  const d = new Date(moved.scheduled_at)
                  d.setFullYear(Number(newDate.slice(0, 4)), Number(newDate.slice(5, 7)) - 1, Number(newDate.slice(8, 10)))
                  newScheduledAt = d.toISOString()
                }
                setPosts(prev => prev.map(p => p.id === slotId
                  ? { ...p, plan_date: newDate, slot_index: null, scheduled_at: newScheduledAt ?? p.scheduled_at }
                  : p
                ))
                try {
                  const body: Record<string, unknown> = { plan_date: newDate, slot_index: null }
                  if (newScheduledAt) {
                    body.scheduled_at = newScheduledAt
                    body.publications = (moved.publications ?? []).map(pub => ({
                      platform: pub.platform,
                      config: pub.config,
                      scheduled_at: newScheduledAt,
                    }))
                  }
                  const res = await fetch(`/api/social/posts/${slotId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  })
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}))
                    throw new Error((j as { error?: string }).error ?? `Erreur ${res.status}`)
                  }
                  toast.success('Slot déplacé', `Du ${oldDate ?? '—'} au ${newDate}`)
                  void reloadSilent()
                } catch (e) {
                  // Revert UNIQUEMENT le slot concerne (pas tout l'array).
                  setPosts(prev => prev.map(p => p.id === slotId
                    ? { ...p, ...previousSnapshot }
                    : p
                  ))
                  toast.error('Erreur déplacement', (e as Error).message)
                }
              }}
            />
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {planModalOpen && (
        <PlanModal
          onClose={() => setPlanModalOpen(false)}
          onConfirm={planRange}
          onEditTrame={() => { setPlanModalOpen(false); setTrameModalOpen(true) }}
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
          onChange={reloadSilent}
        />
      )}
    </div>
  )
}

function buildPostsUrl(cursor: { year: number; month: number }) {
  // Fenêtre : mois courant + 1 mois suivant (suffisant pour board+calendrier en vue par défaut)
  const from = new Date(cursor.year, cursor.month - 1, 1)
  const to = new Date(cursor.year, cursor.month + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // slim=true : payload réduit (pas de script/caption/notes), board/calendar n'en ont pas besoin
  return `/api/social/posts?plan_date_from=${fmt(from)}&plan_date_to=${fmt(to)}&per_page=500&slim=true`
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

function SkeletonBoard() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: 100, height: 30, background: 'var(--bg-secondary)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, height: 320, animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ width: '50%', height: 12, background: 'var(--bg-elevated)', borderRadius: 4, marginBottom: 16 }} />
            {[1, 2, 3].map((j) => (
              <div key={j} style={{ height: 50, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 8 }} />
            ))}
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }`}</style>
    </div>
  )
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
