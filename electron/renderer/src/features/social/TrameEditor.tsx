// Trame editor — port of planning/TrameEditorModal.tsx. Endpoints:
// PUT /api/social/trame, POST /api/social/pillars, PATCH/DELETE
// /api/social/pillars/:id (409 when used → retry with ?mode=detach).
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { Input } from '../../design-system/Input'
import { Field, Modal } from './ui'
import { errMsg, http } from './http'
import { normalizeGrid, replaceInGrid, WEEKDAY_LABELS, WEEKDAYS } from './social-utils'
import type { ContentPillar, ContentTrame, TrameGrid, Weekday } from './types'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

const PALETTE = ['#a78bfa', '#ec4899', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

const DEFAULT_PILLARS: { name: string; color: string }[] = [
  { name: 'Viral', color: '#ec4899' },
  { name: 'Lead Magnet', color: '#3b82f6' },
  { name: 'Avant/Après', color: '#10b981' },
  { name: 'Bénéfices Coaching', color: '#a78bfa' },
  { name: 'Call to Action', color: '#f59e0b' },
  { name: 'Value Asset', color: '#06b6d4' },
  { name: 'Preuve Sociale', color: '#8b5cf6' },
  { name: 'Entrainement', color: '#ef4444' },
  { name: 'Sondage', color: '#14b8a6' },
  { name: 'Bilan', color: '#f97316' },
  { name: 'Analyse Programme', color: '#6366f1' },
  { name: 'Opinion', color: '#db2777' },
  { name: 'Perso', color: '#84cc16' },
  { name: 'Facecam de Valeur', color: '#0ea5e9' },
  { name: 'Retour Client', color: '#f43f5e' },
]

const DEFAULT_STORIES: Record<Weekday, string[]> = {
  mon: ['Viral', 'Lead Magnet', 'Avant/Après', 'Bénéfices Coaching', 'Call to Action'],
  tue: ['Viral', 'Value Asset', 'Preuve Sociale', 'Entrainement', 'Sondage'],
  wed: ['Viral', 'Bilan', 'Avant/Après', 'Call to Action', 'Analyse Programme'],
  thu: ['Viral', 'Lead Magnet', 'Preuve Sociale', 'Entrainement', 'Sondage'],
  fri: ['Viral', 'Avant/Après', 'Bénéfices Coaching', 'Call to Action', 'Opinion'],
  sat: ['Viral', 'Value Asset', 'Preuve Sociale', 'Opinion', 'Entrainement'],
  sun: ['Viral', 'Avant/Après', 'Bénéfices Coaching', 'Call to Action', 'Sondage'],
}

const DEFAULT_POSTS: Record<Weekday, (string | null)[]> = {
  mon: ['Viral', null],
  tue: ['Viral', 'Avant/Après'],
  wed: ['Viral', null],
  thu: ['Facecam de Valeur', null],
  fri: ['Viral', 'Avant/Après'],
  sat: ['Retour Client', null],
  sun: ['Viral', 'Facecam de Valeur'],
}

export function TrameEditor({
  trame,
  pillars,
  notify,
  onClose,
  onSaved,
  onPillarsChanged,
}: {
  trame: ContentTrame | null
  pillars: ContentPillar[]
  notify: Notify
  onClose: () => void
  onSaved: () => void
  onPillarsChanged: () => void
}) {
  const [storiesPerDay, setStoriesPerDay] = useState(trame?.stories_per_day ?? 5)
  const [postsPerDay, setPostsPerDay] = useState(trame?.posts_per_day ?? 2)
  const [storiesGrid, setStoriesGrid] = useState<TrameGrid>(() => normalizeGrid(trame?.stories_grid, trame?.stories_per_day ?? 5))
  const [postsGrid, setPostsGrid] = useState<TrameGrid>(() => normalizeGrid(trame?.posts_grid, trame?.posts_per_day ?? 2))
  const [localPillars, setLocalPillars] = useState<ContentPillar[]>(pillars)
  const [pillarForm, setPillarForm] = useState<{ pillar?: ContentPillar; name: string; color: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ pillar: ContentPillar; usage: number; inTrame: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmImport, setConfirmImport] = useState(false)
  const autoImported = useRef(false)

  useEffect(() => setLocalPillars(pillars), [pillars])

  useEffect(() => {
    if (autoImported.current) return
    if (trame === null && pillars.length === 0) {
      autoImported.current = true
      void importTemplate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function importTemplate() {
    setImporting(true)
    setConfirmImport(false)
    try {
      const existing = new Set(localPillars.map((p) => p.name.toLowerCase()))
      const created: ContentPillar[] = []
      for (const t of DEFAULT_PILLARS) {
        if (existing.has(t.name.toLowerCase())) continue
        const r = await api.post<{ data: ContentPillar }>('/api/social/pillars', t).catch(() => null)
        if (r?.data) created.push(r.data)
      }
      const all = [...localPillars, ...created]
      setLocalPillars(all)
      const byName = new Map(all.map((p) => [p.name.toLowerCase(), p.id]))
      const lookup = (n: string | null) => (n ? (byName.get(n.toLowerCase()) ?? null) : null)
      setStoriesPerDay(5)
      setPostsPerDay(2)
      const s = {} as TrameGrid
      const p = {} as TrameGrid
      for (const wd of WEEKDAYS) {
        s[wd] = DEFAULT_STORIES[wd].map(lookup)
        p[wd] = DEFAULT_POSTS[wd].map(lookup)
      }
      setStoriesGrid(s)
      setPostsGrid(p)
      onPillarsChanged()
    } finally {
      setImporting(false)
    }
  }

  async function savePillar() {
    if (!pillarForm || !pillarForm.name.trim()) return
    const data = { name: pillarForm.name.trim(), color: pillarForm.color }
    try {
      if (pillarForm.pillar) {
        const r = await api.patch<{ data: ContentPillar }>(`/api/social/pillars/${pillarForm.pillar.id}`, data)
        setLocalPillars((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x)))
      } else {
        const r = await api.post<{ data: ContentPillar }>('/api/social/pillars', data)
        setLocalPillars((prev) => [...prev, r.data])
      }
      setPillarForm(null)
      onPillarsChanged()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  function afterPillarDeleted(id: string) {
    setLocalPillars((prev) => prev.filter((x) => x.id !== id))
    setStoriesGrid((g) => replaceInGrid(g, id, null))
    setPostsGrid((g) => replaceInGrid(g, id, null))
    onPillarsChanged()
  }

  async function deletePillar(p: ContentPillar) {
    try {
      await http('DELETE', `/api/social/pillars/${p.id}`)
      afterPillarDeleted(p.id)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // The 409 body carries usage counts; re-read them to show the same prompt as the web.
        setPendingDelete({ pillar: p, usage: -1, inTrame: -1 })
      } else notify(errMsg(e), 'danger')
    }
  }

  async function confirmDetach() {
    if (!pendingDelete) return
    try {
      await http('DELETE', `/api/social/pillars/${pendingDelete.pillar.id}?mode=detach`)
      afterPillarDeleted(pendingDelete.pillar.id)
      setPendingDelete(null)
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function save() {
    setSaving(true)
    try {
      await http('PUT', '/api/social/trame', {
        stories_grid: storiesGrid,
        posts_grid: postsGrid,
        stories_per_day: storiesPerDay,
        posts_per_day: postsPerDay,
      })
      onSaved()
    } catch (e) {
      notify(`Erreur sauvegarde : ${errMsg(e)}`, 'danger')
    } finally {
      setSaving(false)
    }
  }

  const hasContent = localPillars.length > 0 || Object.values(storiesGrid).some((a) => a.some(Boolean)) || Object.values(postsGrid).some((a) => a.some(Boolean))

  return (
    <Modal title="Ma trame de contenu" onClose={onClose} size="wide">
      <div className="soc-stack">
        <p className="soc-muted" style={{ margin: 0 }}>
          Définis ton pattern hebdomadaire — il sera utilisé pour générer automatiquement les slots.
        </p>
        <section className="soc-card">
          <div className="soc-card-head">
            <h3 className="soc-card-title">Bibliothèque de piliers</h3>
            {confirmImport ? (
              <span className="soc-row">
                <span className="soc-muted">Crée 15 piliers + remplit les grilles (piliers existants conservés).</span>
                <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void importTemplate()}>
                  Continuer
                </button>
                <button type="button" className="ds-pill-button" onClick={() => setConfirmImport(false)}>
                  Annuler
                </button>
              </span>
            ) : (
              <button type="button" className="ds-pill-button" disabled={importing} onClick={() => (hasContent ? setConfirmImport(true) : void importTemplate())}>
                {importing ? 'Import…' : 'Template par défaut'}
              </button>
            )}
          </div>
          <div className="soc-row">
            {localPillars.map((p) => (
              <span key={p.id} className="soc-tag">
                <span className="soc-dot" style={{ background: p.color, width: 8, height: 8 }} />
                <button type="button" style={{ color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 600 }} onClick={() => setPillarForm({ pillar: p, name: p.name, color: p.color })}>
                  {p.name}
                </button>
                <button type="button" title="Supprimer" onClick={() => void deletePillar(p)}>
                  ×
                </button>
              </span>
            ))}
            <button type="button" className="ds-pill-button" onClick={() => setPillarForm({ name: '', color: PALETTE[0] })}>
              + Ajouter
            </button>
          </div>
          {pendingDelete && (
            <div className="soc-banner soc-banner--warning">
              « {pendingDelete.pillar.name} » est utilisé (slots et/ou cellules de trame). Le détacher (cellules vidées, slots gardés sans pilier) ?
              <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void confirmDetach()}>
                Détacher et supprimer
              </button>
              <button type="button" className="ds-pill-button" onClick={() => setPendingDelete(null)}>
                Annuler
              </button>
            </div>
          )}
          {pillarForm && (
            <div className="soc-row" style={{ alignItems: 'flex-end' }}>
              <div style={{ minWidth: 220 }}>
                <Field label={pillarForm.pillar ? 'Modifier le pilier' : 'Nouveau pilier'}>
                  <Input value={pillarForm.name} autoFocus onChange={(e) => setPillarForm({ ...pillarForm, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && void savePillar()} placeholder="ex : Viral, Lead Magnet…" />
                </Field>
              </div>
              <div className="soc-row">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setPillarForm({ ...pillarForm, color: c })}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: pillarForm.color === c ? '2px solid var(--color-text-strong)' : '2px solid transparent', cursor: 'pointer' }}
                  />
                ))}
              </div>
              <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!pillarForm.name.trim()} onClick={() => void savePillar()}>
                {pillarForm.pillar ? 'Enregistrer' : 'Créer'}
              </button>
              <button type="button" className="ds-pill-button" onClick={() => setPillarForm(null)}>
                Annuler
              </button>
            </div>
          )}
        </section>

        <GridSection
          title="Stories quotidiennes"
          prefix="Story"
          perDay={storiesPerDay}
          max={10}
          grid={storiesGrid}
          pillars={localPillars}
          onPerDay={(n) => {
            setStoriesPerDay(n)
            setStoriesGrid((g) => normalizeGrid(g, n))
          }}
          onCell={(wd, idx, pid) => setStoriesGrid((g) => ({ ...g, [wd]: g[wd].map((c, i) => (i === idx ? pid : c)) }))}
        />
        <GridSection
          title="Posts quotidiens"
          prefix="Post"
          perDay={postsPerDay}
          max={5}
          grid={postsGrid}
          pillars={localPillars}
          onPerDay={(n) => {
            setPostsPerDay(n)
            setPostsGrid((g) => normalizeGrid(g, n))
          }}
          onCell={(wd, idx, pid) => setPostsGrid((g) => ({ ...g, [wd]: g[wd].map((c, i) => (i === idx ? pid : c)) }))}
        />

        <div className="lead-create-actions" style={{ justifyContent: 'space-between' }}>
          <span className="soc-muted">Choisis un pilier par cellule — vide = pas de slot ce jour-là.</span>
          <span className="soc-row">
            <button type="button" className="ds-pill-button" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving} onClick={() => void save()}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </span>
        </div>
      </div>
    </Modal>
  )
}

function GridSection({
  title,
  prefix,
  perDay,
  max,
  grid,
  pillars,
  onPerDay,
  onCell,
}: {
  title: string
  prefix: string
  perDay: number
  max: number
  grid: TrameGrid
  pillars: ContentPillar[]
  onPerDay: (n: number) => void
  onCell: (wd: Weekday, idx: number, pillarId: string | null) => void
}) {
  return (
    <section className="soc-card">
      <div className="soc-card-head">
        <h3 className="soc-card-title">{title}</h3>
        <span className="soc-row">
          <span className="soc-muted">Slots / jour :</span>
          <button type="button" className="ds-pill-button" onClick={() => onPerDay(Math.max(0, perDay - 1))}>
            −
          </button>
          <span className="ds-num">{perDay}</span>
          <button type="button" className="ds-pill-button" onClick={() => onPerDay(Math.min(max, perDay + 1))}>
            +
          </button>
        </span>
      </div>
      {perDay === 0 ? (
        <p className="soc-muted">Aucun slot configuré pour ce type.</p>
      ) : (
        <div className="soc-trame" style={{ gridTemplateColumns: `90px repeat(${perDay}, minmax(120px, 1fr))` }}>
          <div />
          {Array.from({ length: perDay }).map((_, i) => (
            <div key={i} className="soc-cal-head">
              {prefix} {i + 1}
            </div>
          ))}
          {WEEKDAYS.map((wd) => (
            <div key={wd} style={{ display: 'contents' }}>
              <div className="soc-cal-head" style={{ textAlign: 'left' }}>
                {WEEKDAY_LABELS[wd].slice(0, 3)}
              </div>
              {Array.from({ length: perDay }).map((_, idx) => {
                const pid = grid[wd][idx]
                const p = pid ? pillars.find((x) => x.id === pid) : undefined
                return (
                  <select
                    key={idx}
                    className="soc-trame-cell"
                    value={pid ?? ''}
                    style={p ? { borderColor: p.color, background: `${p.color}1a` } : undefined}
                    onChange={(e) => onCell(wd, idx, e.target.value || null)}
                  >
                    <option value="">+</option>
                    {pillars.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
