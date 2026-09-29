// Planning (calendrier éditorial) — port of components/social/planning/
// PlanningView + PlanningCalendarView + BoardView + PlanModal. Endpoints:
// GET /api/social/trame, GET /api/social/pillars, GET /api/social/posts
// (plan_date window, slim=true), POST /api/social/posts, PATCH
// /api/social/posts/:id (drag & drop date / production_status),
// POST /api/social/trame/generate (window=range).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrGet } from '../../lib/query-cache'
import { Chips, Tabs } from '../../design-system/Tabs'
import { ErrorState, LoadingState } from '../../design-system/States'
import { Field, Modal } from './ui'
import { errMsg } from './http'
import {
  isoDay,
  monthCells,
  periodRange,
  planningWindow,
  planPresetRange,
  PRODUCTION_STATUSES,
  weekKey,
  type BoardPeriod,
  type PlanPreset,
} from './social-utils'
import { TrameEditor } from './TrameEditor'
import { SlotDrawer } from './SlotDrawer'
import { TournagesPanel } from './TournagesPanel'
import type { ContentPillar, ContentTrame, ListResponse, SocialContentKind, SocialPost, SocialProductionStatus } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const KIND_LABEL: Record<SocialContentKind, string> = { post: 'Post', story: 'Story', reel: 'Reel' }
const VIEW_KEY = 'social_planning_view_mode'

function statusMeta(s: SocialProductionStatus | null) {
  return PRODUCTION_STATUSES.find((p) => p.value === (s ?? 'idea')) ?? PRODUCTION_STATUSES[0]
}

export function PlanningView({ notify }: { notify: Notify }) {
  const [view, setView] = useState<'calendar' | 'board'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'calendar'
    } catch {
      return 'calendar'
    }
  })
  const [trame, setTrame] = useState<ContentTrame | null>(null)
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [structureLoading, setStructureLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }))
  const [trameOpen, setTrameOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [tournagesOpen, setTournagesOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      /* ignore */
    }
  }, [view])

  const reloadStructure = useCallback(async () => {
    setStructureLoading(true)
    setError(null)
    try {
      const [t, p] = await Promise.all([
        api.get<{ data: ContentTrame | null }>('/api/social/trame'),
        api.get<ListResponse<ContentPillar>>('/api/social/pillars'),
      ])
      setTrame(t.data ?? null)
      setPillars(p.data ?? [])
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setStructureLoading(false)
    }
  }, [])

  const reloadPosts = useCallback(
    async (silent = false) => {
      if (!silent) setPostsLoading(true)
      try {
        const w = planningWindow(cursor.year, cursor.month)
        await swrGet<ListResponse<SocialPost>>(`/api/social/posts?plan_date_from=${w.from}&plan_date_to=${w.to}&per_page=500&slim=true`, (r) => {
          setPosts(r.data ?? [])
          if (!silent) setPostsLoading(false)
        })
      } catch (e) {
        notify(errMsg(e), 'danger')
      } finally {
        if (!silent) setPostsLoading(false)
      }
    },
    [cursor, notify],
  )

  useEffect(() => {
    void reloadStructure()
  }, [reloadStructure])
  useEffect(() => {
    void reloadPosts()
  }, [reloadPosts])

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadStructure(), reloadPosts()])
  }, [reloadStructure, reloadPosts])

  async function createPost(planDate?: string) {
    try {
      const r = await api.post<{ data?: { id: string } }>('/api/social/posts', {
        content_kind: 'post',
        production_status: 'idea',
        status: 'draft',
        plan_date: planDate ?? isoDay(new Date()),
        publications: [],
      })
      if (r.data?.id) setSelectedSlot(r.data.id)
      void reloadPosts(true)
    } catch (e) {
      notify(`Erreur création slot : ${errMsg(e)}`, 'danger')
    }
  }

  async function moveSlot(slotId: string, newDate: string) {
    const moved = posts.find((p) => p.id === slotId)
    if (!moved) return
    const oldDate = moved.plan_date?.slice(0, 10) ?? null
    if (oldDate === newDate) return
    const snapshot = { plan_date: moved.plan_date, slot_index: moved.slot_index, scheduled_at: moved.scheduled_at }
    let newScheduledAt: string | null = null
    if (moved.scheduled_at) {
      const d = new Date(moved.scheduled_at)
      d.setFullYear(Number(newDate.slice(0, 4)), Number(newDate.slice(5, 7)) - 1, Number(newDate.slice(8, 10)))
      newScheduledAt = d.toISOString()
    }
    setPosts((prev) => prev.map((p) => (p.id === slotId ? { ...p, plan_date: newDate, slot_index: null, scheduled_at: newScheduledAt ?? p.scheduled_at } : p)))
    try {
      const body: Record<string, unknown> = { plan_date: newDate, slot_index: null }
      if (newScheduledAt) {
        body.scheduled_at = newScheduledAt
        body.publications = (moved.publications ?? []).map((pub) => ({ platform: pub.platform, config: pub.config, scheduled_at: newScheduledAt }))
      }
      await api.patch(`/api/social/posts/${slotId}`, body)
      notify(`Slot déplacé du ${oldDate ?? '—'} au ${newDate}`)
      void reloadPosts(true)
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === slotId ? { ...p, ...snapshot } : p)))
      notify(`Erreur déplacement : ${errMsg(e)}`, 'danger')
    }
  }

  async function moveStatus(slot: SocialPost, status: SocialProductionStatus) {
    if (status === 'ready' && (!slot.media_urls || slot.media_urls.length === 0)) {
      notify('Pour passer en "Prêt", il faut au moins un média uploadé.', 'warning')
      return
    }
    if (slot.production_status === status) return
    const previous = slot.production_status
    setPosts((prev) => prev.map((p) => (p.id === slot.id ? { ...p, production_status: status } : p)))
    try {
      await api.patch(`/api/social/posts/${slot.id}`, { production_status: status })
      void reloadPosts(true)
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === slot.id ? { ...p, production_status: previous } : p)))
      notify(errMsg(e), 'danger')
    }
  }

  return (
    <div className="soc-stack">
      <div className="soc-toolbar">
        <Tabs
          items={[
            { key: 'calendar', label: 'Calendrier' },
            { key: 'board', label: 'Board' },
          ]}
          active={view}
          onChange={setView}
        />
        <div className="soc-spacer" />
        <button type="button" className="ds-pill-button" onClick={() => setTournagesOpen(true)}>
          Tournages
        </button>
        <button type="button" className="ds-pill-button" onClick={() => setTrameOpen(true)}>
          Ma trame
        </button>
        <button type="button" className="ds-pill-button" onClick={() => void createPost()}>
          + Nouveau post
        </button>
        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => (trame ? setPlanOpen(true) : setTrameOpen(true))}>
          Générer des slots
        </button>
      </div>

      {structureLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reloadStructure()} />
      ) : !trame ? (
        <section className="soc-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 className="soc-card-title">Pas encore de trame</h2>
          <p className="soc-muted" style={{ maxWidth: 440 }}>
            Définis ta trame de contenu hebdomadaire (stories quotidiennes + posts) pour pouvoir générer automatiquement les slots du mois.
          </p>
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setTrameOpen(true)}>
            Créer ma trame
          </button>
        </section>
      ) : (
        <>
          {postsLoading && <span className="soc-muted">Chargement des slots…</span>}
          {view === 'calendar' ? (
            <CalendarView
              posts={posts}
              pillars={pillars}
              cursor={cursor}
              onCursorChange={setCursor}
              onSelect={setSelectedSlot}
              onCreate={(d) => void createPost(d)}
              onMove={(id, d) => void moveSlot(id, d)}
            />
          ) : (
            <BoardView posts={posts} pillars={pillars} onSelect={setSelectedSlot} onMoveStatus={(s, st) => void moveStatus(s, st)} />
          )}
        </>
      )}

      {planOpen && (
        <PlanModal
          onClose={() => setPlanOpen(false)}
          onEditTrame={() => {
            setPlanOpen(false)
            setTrameOpen(true)
          }}
          onDone={(created, skipped) => {
            setPlanOpen(false)
            notify(`${created} slots créés${skipped ? ` · ${skipped} déjà existants ignorés` : ''}`)
            void reloadAll()
          }}
        />
      )}
      {trameOpen && (
        <TrameEditor
          trame={trame}
          pillars={pillars}
          notify={notify}
          onClose={() => setTrameOpen(false)}
          onSaved={() => {
            setTrameOpen(false)
            void reloadAll()
          }}
          onPillarsChanged={() => void reloadStructure()}
        />
      )}
      {selectedSlot && (
        <SlotDrawer slotId={selectedSlot} pillars={pillars} notify={notify} onClose={() => setSelectedSlot(null)} onChange={() => void reloadPosts(true)} />
      )}
      {tournagesOpen && <TournagesPanel notify={notify} onClose={() => setTournagesOpen(false)} />}
    </div>
  )
}

function CalendarView({
  posts,
  pillars,
  cursor,
  onCursorChange,
  onSelect,
  onCreate,
  onMove,
}: {
  posts: SocialPost[]
  pillars: ContentPillar[]
  cursor: { year: number; month: number }
  onCursorChange: (c: { year: number; month: number }) => void
  onSelect: (id: string) => void
  onCreate: (date: string) => void
  onMove: (id: string, date: string) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dayPopover, setDayPopover] = useState<string | null>(null)
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor])
  const todayKey = isoDay(new Date())
  const pillarOf = (id: string | null) => pillars.find((p) => p.id === id)

  const byDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const p of posts) {
      const key = p.plan_date?.slice(0, 10) ?? (p.scheduled_at ? p.scheduled_at.slice(0, 10) : null)
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
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

  const nav = (delta: number) => {
    const m = cursor.month + delta
    if (m < 1) onCursorChange({ year: cursor.year - 1, month: 12 })
    else if (m > 12) onCursorChange({ year: cursor.year + 1, month: 1 })
    else onCursorChange({ year: cursor.year, month: m })
  }

  return (
    <div className="soc-stack">
      <div className="soc-toolbar">
        <button type="button" className="ds-pill-button" onClick={() => nav(-1)}>
          ‹
        </button>
        <strong style={{ minWidth: 150, textAlign: 'center' }}>
          {MONTHS[cursor.month - 1]} {cursor.year}
        </strong>
        <button type="button" className="ds-pill-button" onClick={() => nav(1)}>
          ›
        </button>
        <button type="button" className="ds-pill-button" onClick={() => onCursorChange({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}>
          Aujourd'hui
        </button>
        <div className="soc-spacer" />
        <div className="soc-legend">
          {PRODUCTION_STATUSES.map((s) => (
            <span key={s.value} className="soc-row">
              <span className="soc-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span>✓ Publié · ● Programmé</span>
        </div>
      </div>
      <div className="soc-cal">
        {WEEKDAYS.map((w) => (
          <div key={w} className="soc-cal-head">
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const day = byDate.get(c.key) ?? []
          const dayPosts = day.filter((p) => p.content_kind !== 'story')
          const stories = day.filter((p) => p.content_kind === 'story')
          const isPast = c.key < todayKey
          const canDrop = dragging !== null && !isPast && c.inMonth
          return (
            <div
              key={c.key}
              className={`soc-cal-cell ${!c.inMonth ? 'soc-cal-cell--out' : ''} ${c.weekend && c.inMonth ? 'soc-cal-cell--weekend' : ''} ${c.key === todayKey ? 'soc-cal-cell--today' : ''} ${canDrop && dragOver === c.key ? 'soc-cal-cell--drop' : ''}`}
              onDragOver={(e) => {
                if (!canDrop) return
                e.preventDefault()
                if (dragOver !== c.key) setDragOver(c.key)
              }}
              onDragLeave={() => dragOver === c.key && setDragOver(null)}
              onDrop={(e) => {
                if (!canDrop) return
                e.preventDefault()
                const id = e.dataTransfer.getData('text/slot-id') || dragging
                setDragging(null)
                setDragOver(null)
                if (id) onMove(id, c.key)
              }}
            >
              <div className="soc-cal-day">
                <span>{c.day}</span>
                {day.length > 0 && (
                  <span className="ds-muted" style={{ fontSize: 9 }}>
                    {dayPosts.length > 0 && `${dayPosts.length}P `}
                    {stories.length > 0 && `${stories.length}S`}
                  </span>
                )}
              </div>
              {dayPosts.slice(0, 4).map((p) => {
                const pillar = pillarOf(p.pillar_id)
                const meta = statusMeta(p.production_status)
                const published = p.status === 'published'
                const draggable = !published && p.status !== 'publishing'
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="soc-chip-slot"
                    style={{ ['--pillar-color' as string]: pillar?.color ?? '#9aa0a6', opacity: published ? 0.7 : 1 }}
                    draggable={draggable}
                    onDragStart={(e) => {
                      if (!draggable) return
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/slot-id', p.id)
                      setDragging(p.id)
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setDragOver(null)
                    }}
                    onClick={() => onSelect(p.id)}
                    title={`${pillar?.name ?? '—'} · ${published ? 'Publié' : p.status === 'scheduled' ? 'Programmé' : meta.label}${p.hook || p.title ? ` · ${p.hook || p.title}` : ''}`}
                  >
                    <span className="soc-chip-slot-pillar">
                      <span className="soc-dot" style={{ background: published ? 'var(--color-success)' : p.status === 'failed' ? 'var(--color-danger)' : meta.color, width: 6, height: 6 }} />
                      {published && '✓ '}
                      {pillar?.name ?? KIND_LABEL[p.content_kind ?? 'post']}
                      {p.status === 'scheduled' && ' ●'}
                      {p.status === 'failed' && ' !'}
                    </span>
                    {(p.hook || p.title) && <span className="soc-chip-slot-hook">{p.hook || p.title}</span>}
                  </button>
                )
              })}
              {dayPosts.length > 4 && (
                <button type="button" className="soc-link-btn" onClick={() => setDayPopover(c.key)}>
                  +{dayPosts.length - 4} post{dayPosts.length - 4 > 1 ? 's' : ''}…
                </button>
              )}
              {day.length === 0 && c.inMonth && !isPast && (
                <button type="button" className="soc-cal-add" onClick={() => onCreate(c.key)}>
                  + Nouveau post
                </button>
              )}
              {stories.length > 0 && (
                <div className="soc-story-chips">
                  {stories.slice(0, 4).map((s) => {
                    const pillar = pillarOf(s.pillar_id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="soc-story-chip"
                        style={{ ['--pillar-color' as string]: pillar?.color ?? '#ec4899', opacity: s.status === 'published' ? 0.6 : 1 }}
                        title={`${pillar?.name ?? 'Story'} · ${statusMeta(s.production_status).label}`}
                        onClick={() => onSelect(s.id)}
                      >
                        {pillar?.name?.slice(0, 6) ?? 'Story'}
                      </button>
                    )
                  })}
                  {stories.length > 4 && (
                    <button type="button" className="soc-link-btn" onClick={() => setDayPopover(c.key)}>
                      +{stories.length - 4}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {dayPopover && (
        <Modal
          title={new Date(`${dayPopover}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          onClose={() => setDayPopover(null)}
        >
          <div className="soc-stack">
            {(byDate.get(dayPopover) ?? []).map((p) => {
              const pillar = pillarOf(p.pillar_id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className="soc-chip-slot"
                  style={{ ['--pillar-color' as string]: pillar?.color ?? '#9aa0a6' }}
                  onClick={() => {
                    setDayPopover(null)
                    onSelect(p.id)
                  }}
                >
                  <span className="soc-chip-slot-pillar">
                    {KIND_LABEL[p.content_kind ?? 'post']} · {pillar?.name ?? '—'} · {statusMeta(p.production_status).label}
                  </span>
                  <span className="soc-chip-slot-hook">{p.hook || p.title || '(sans accroche)'}</span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

function BoardView({
  posts,
  pillars,
  onSelect,
  onMoveStatus,
}: {
  posts: SocialPost[]
  pillars: ContentPillar[]
  onSelect: (id: string) => void
  onMoveStatus: (slot: SocialPost, status: SocialProductionStatus) => void
}) {
  const initial = useMemo<BoardPeriod>(() => {
    for (const k of ['this_week', 'this_month', 'next_month'] as BoardPeriod[]) {
      const r = periodRange(k)
      if (posts.some((p) => p.plan_date && r.from && r.to && p.plan_date >= r.from && p.plan_date <= r.to)) return k
    }
    return 'all'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [period, setPeriod] = useState<BoardPeriod>(initial)
  const [kind, setKind] = useState<SocialContentKind | 'all'>('all')
  const [pillar, setPillar] = useState<string>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)

  const range = periodRange(period)
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)
  const cutoff = isoDay(cutoffDate)

  const visible = posts.filter((p) => {
    if (kind !== 'all' && p.content_kind !== kind) return false
    if (pillar !== 'all' && p.pillar_id !== pillar) return false
    if (range.from && (!p.plan_date || p.plan_date < range.from)) return false
    if (range.to && (!p.plan_date || p.plan_date > range.to)) return false
    if (!showHistory) {
      if (!['draft', 'scheduled', 'failed'].includes(p.status)) return false
      if (p.plan_date && p.plan_date < cutoff && period !== 'all') return false
    }
    return true
  })
  const periodHasSlots = period === 'all' ? posts.length > 0 : posts.some((p) => p.plan_date && range.from && range.to && p.plan_date >= range.from && p.plan_date <= range.to)

  return (
    <div className="soc-stack">
      <div className="soc-toolbar">
        <Chips
          items={[
            { key: 'this_week', label: 'Cette semaine' },
            { key: 'this_month', label: 'Ce mois' },
            { key: 'next_month', label: 'Mois prochain' },
            { key: 'all', label: 'Tout' },
          ]}
          active={period}
          onChange={setPeriod}
        />
        <select className="soc-select" value={kind} onChange={(e) => setKind(e.target.value as SocialContentKind | 'all')}>
          <option value="all">Type : tous</option>
          <option value="post">Posts</option>
          <option value="story">Stories</option>
          <option value="reel">Reels</option>
        </select>
        <select className="soc-select" value={pillar} onChange={(e) => setPillar(e.target.value)}>
          <option value="all">Pilier : tous</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className={`ds-pill-button ${showHistory ? 'ds-pill-button--dark' : ''}`} onClick={() => setShowHistory((s) => !s)}>
          Publiés / anciens
        </button>
        <div className="soc-spacer" />
        <span className="soc-muted">
          {visible.length} slot{visible.length > 1 ? 's' : ''}
        </span>
      </div>
      {!periodHasSlots && posts.length > 0 && (
        <div className="soc-banner soc-banner--info">
          Aucun slot pour cette période — {posts.length} slots existent ailleurs (fenêtre chargée : mois affiché + suivant).
          <button type="button" className="soc-link-btn" onClick={() => setPeriod('all')}>
            Voir tout
          </button>
        </div>
      )}
      <div className="soc-board">
        {PRODUCTION_STATUSES.map((col) => {
          const colPosts = visible.filter((p) => (p.production_status ?? 'idea') === col.value)
          const groups = new Map<string, SocialPost[]>()
          for (const p of colPosts) {
            const k = p.plan_date ? weekKey(p.plan_date) : 'no_date'
            groups.set(k, [...(groups.get(k) ?? []), p])
          }
          const sortedGroups = [...groups.entries()].sort(([a], [b]) => (a === 'no_date' ? 1 : b === 'no_date' ? -1 : a < b ? -1 : 1))
          return (
            <div
              key={col.value}
              className="soc-board-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const slot = posts.find((p) => p.id === dragging)
                setDragging(null)
                if (slot) onMoveStatus(slot, col.value)
              }}
            >
              <div className="soc-board-col-head">
                <span className="soc-row">
                  <span className="soc-dot" style={{ background: col.color }} />
                  {col.label}
                </span>
                <span className="ds-num">{colPosts.length}</span>
              </div>
              {colPosts.length === 0 && <span className="soc-muted" style={{ textAlign: 'center', padding: 16 }}>Vide</span>}
              {sortedGroups.map(([wk, list]) => (
                <div key={wk} className="soc-stack" style={{ gap: 6 }}>
                  {sortedGroups.length > 1 && (
                    <div className="soc-board-week">
                      {wk === 'no_date'
                        ? 'Sans date'
                        : (() => {
                            const d = new Date(`${wk}T00:00:00`)
                            const s = new Date(d)
                            s.setDate(d.getDate() + 6)
                            return `Sem. ${d.getDate()}/${d.getMonth() + 1}–${s.getDate()}/${s.getMonth() + 1}`
                          })()}{' '}
                      · {list.length}
                    </div>
                  )}
                  {list.map((p) => {
                    const pl = pillars.find((x) => x.id === p.pillar_id)
                    return (
                      <div
                        key={p.id}
                        className="soc-board-card"
                        draggable
                        style={{ ['--pillar-color' as string]: pl?.color ?? '#9aa0a6' }}
                        onDragStart={() => setDragging(p.id)}
                        onClick={() => onSelect(p.id)}
                      >
                        <div className="soc-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: pl?.color ?? 'var(--color-text-tertiary)' }}>{pl?.name ?? '—'}</span>
                          <span className="ds-muted" style={{ fontSize: 10 }}>{KIND_LABEL[p.content_kind ?? 'post']}</span>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.hook || p.title || <span className="ds-muted">+ Cliquer pour ajouter une accroche</span>}</div>
                        <div className="soc-row" style={{ justifyContent: 'space-between' }}>
                          <span className="ds-muted" style={{ fontSize: 10 }}>
                            {p.plan_date ? new Date(`${p.plan_date.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) : ''}
                          </span>
                          <span className="ds-muted" style={{ fontSize: 10 }}>
                            {p.rush_url ? 'Rush ' : ''}
                            {p.final_url ? '· Montage' : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlanModal({ onClose, onDone, onEditTrame }: { onClose: () => void; onDone: (created: number, skipped: number) => void; onEditTrame: () => void }) {
  const [preset, setPreset] = useState<PlanPreset>('next_month')
  const [range, setRange] = useState(() => planPresetRange('next_month'))
  const [kinds, setKinds] = useState({ post: true, story: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function choose(p: PlanPreset) {
    setPreset(p)
    if (p !== 'custom') setRange(planPresetRange(p))
    if (p === 'this_week' || p === 'next_week') setKinds({ post: true, story: true })
    else if (p === 'this_month' || p === 'next_month') setKinds({ post: true, story: false })
  }

  async function submit() {
    if (!kinds.post && !kinds.story) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await api.post<{ data: { slots_created: number; slots_skipped?: number } }>('/api/social/trame/generate', {
        kinds: [...(kinds.post ? ['post'] : []), ...(kinds.story ? ['story'] : [])],
        window: 'range',
        start_date: range.start,
        end_date: range.end,
      })
      onDone(r.data.slots_created, r.data.slots_skipped ?? 0)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  const days = Math.max(0, Math.floor((Date.parse(`${range.end}T00:00:00`) - Date.parse(`${range.start}T00:00:00`)) / 86400000) + 1)

  return (
    <Modal title="Générer des slots" onClose={onClose} size="mid">
      <div className="soc-stack">
        <p className="soc-muted" style={{ margin: 0 }}>
          Crée des slots vides à partir de ta trame, prêts à enrichir.{' '}
          <button type="button" className="soc-link-btn" onClick={onEditTrame}>
            Modifier la trame
          </button>
        </p>
        <Field label="Période">
          <Chips
            items={[
              { key: 'this_week', label: 'Cette semaine' },
              { key: 'next_week', label: '7 prochains jours' },
              { key: 'this_month', label: 'Ce mois' },
              { key: 'next_month', label: 'Mois prochain' },
              { key: 'custom', label: 'Personnalisée' },
            ]}
            active={preset}
            onChange={choose}
          />
          <div className="soc-row">
            <input className="ds-input" type="date" value={range.start} onChange={(e) => { setRange((r) => ({ ...r, start: e.target.value })); setPreset('custom') }} />
            <span>→</span>
            <input className="ds-input" type="date" value={range.end} onChange={(e) => { setRange((r) => ({ ...r, end: e.target.value })); setPreset('custom') }} />
          </div>
          <span className="soc-muted">{days} jour{days > 1 ? 's' : ''}</span>
        </Field>
        <Field label="Types de contenu">
          <div className="soc-row">
            <label className="soc-row">
              <input type="checkbox" checked={kinds.post} onChange={(e) => setKinds((k) => ({ ...k, post: e.target.checked }))} /> Posts
            </label>
            <label className="soc-row">
              <input type="checkbox" checked={kinds.story} onChange={(e) => setKinds((k) => ({ ...k, story: e.target.checked }))} /> Stories
            </label>
          </div>
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={submitting || (!kinds.post && !kinds.story) || days === 0} onClick={() => void submit()}>
            {submitting ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

