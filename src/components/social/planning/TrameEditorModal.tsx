'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Pencil, Sparkles, Wand2 } from 'lucide-react'
import {
  type ContentPillar,
  type ContentTrame,
  type Weekday,
  WEEKDAYS_ORDERED,
  WEEKDAY_LABELS,
} from '@/types'

interface Props {
  trame: ContentTrame | null
  pillars: ContentPillar[]
  onClose: () => void
  onSaved: () => void
}

const PALETTE = [
  '#a78bfa', '#ec4899', '#3b82f6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316',
]

// Template par défaut basé sur la trame coach standard
const DEFAULT_PILLARS: { name: string; color: string }[] = [
  { name: 'Viral',              color: '#ec4899' },
  { name: 'Lead Magnet',        color: '#3b82f6' },
  { name: 'Avant/Après',        color: '#10b981' },
  { name: 'Bénéfices Coaching', color: '#a78bfa' },
  { name: 'Call to Action',     color: '#f59e0b' },
  { name: 'Value Asset',        color: '#06b6d4' },
  { name: 'Preuve Sociale',     color: '#8b5cf6' },
  { name: 'Entrainement',       color: '#ef4444' },
  { name: 'Sondage',            color: '#14b8a6' },
  { name: 'Bilan',              color: '#f97316' },
  { name: 'Analyse Programme',  color: '#6366f1' },
  { name: 'Opinion',            color: '#db2777' },
  { name: 'Perso',              color: '#84cc16' },
  { name: 'Facecam de Valeur',  color: '#0ea5e9' },
  { name: 'Retour Client',      color: '#f43f5e' },
]

const DEFAULT_STORIES: Record<Weekday, string[]> = {
  mon: ['Viral', 'Lead Magnet',  'Avant/Après',    'Bénéfices Coaching', 'Call to Action'],
  tue: ['Viral', 'Value Asset',  'Preuve Sociale', 'Entrainement',       'Sondage'],
  wed: ['Viral', 'Bilan',        'Avant/Après',    'Call to Action',     'Analyse Programme'],
  thu: ['Viral', 'Lead Magnet',  'Preuve Sociale', 'Entrainement',       'Sondage'],
  fri: ['Viral', 'Avant/Après',  'Bénéfices Coaching', 'Call to Action', 'Opinion'],
  sat: ['Viral', 'Value Asset',  'Preuve Sociale', 'Opinion',            'Entrainement'],
  sun: ['Viral', 'Avant/Après',  'Bénéfices Coaching', 'Call to Action', 'Sondage'],
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

function hasAnyCellFilled(grid: Record<Weekday, (string | null)[]>): boolean {
  return Object.values(grid).some((arr) => arr?.some((c) => c !== null))
}

function emptyGrid(perDay: number): Record<Weekday, (string | null)[]> {
  const out = {} as Record<Weekday, (string | null)[]>
  for (const wd of WEEKDAYS_ORDERED) out[wd] = Array(perDay).fill(null)
  return out
}

function normalizeGrid(
  grid: Record<Weekday, (string | null)[]> | undefined,
  perDay: number
): Record<Weekday, (string | null)[]> {
  const out = {} as Record<Weekday, (string | null)[]>
  for (const wd of WEEKDAYS_ORDERED) {
    const arr = (grid?.[wd] ?? []).slice(0, perDay)
    while (arr.length < perDay) arr.push(null)
    out[wd] = arr
  }
  return out
}

export default function TrameEditorModal({ trame, pillars, onClose, onSaved }: Props) {
  const [storiesPerDay, setStoriesPerDay] = useState(trame?.stories_per_day ?? 5)
  const [postsPerDay, setPostsPerDay] = useState(trame?.posts_per_day ?? 2)
  const [storiesGrid, setStoriesGrid] = useState(() => normalizeGrid(trame?.stories_grid, trame?.stories_per_day ?? 5))
  const [postsGrid, setPostsGrid] = useState(() => normalizeGrid(trame?.posts_grid, trame?.posts_per_day ?? 2))
  const [localPillars, setLocalPillars] = useState<ContentPillar[]>(pillars)
  const [saving, setSaving] = useState(false)
  const [pillarModal, setPillarModal] = useState<{ mode: 'create' | 'edit'; pillar?: ContentPillar } | null>(null)
  const [activePicker, setActivePicker] = useState<{ kind: 'story' | 'post'; wd: Weekday; idx: number } | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { setLocalPillars(pillars) }, [pillars])

  const updateStoriesPerDay = (n: number) => {
    setStoriesPerDay(n)
    setStoriesGrid(normalizeGrid(storiesGrid, n))
  }
  const updatePostsPerDay = (n: number) => {
    setPostsPerDay(n)
    setPostsGrid(normalizeGrid(postsGrid, n))
  }

  const setStoryCell = (wd: Weekday, idx: number, pid: string | null) => {
    setStoriesGrid({ ...storiesGrid, [wd]: storiesGrid[wd].map((c, i) => (i === idx ? pid : c)) })
  }
  const setPostCell = (wd: Weekday, idx: number, pid: string | null) => {
    setPostsGrid({ ...postsGrid, [wd]: postsGrid[wd].map((c, i) => (i === idx ? pid : c)) })
  }

  const upsertPillar = async (data: { name: string; color: string }, id?: string) => {
    if (id) {
      const res = await fetch(`/api/social/pillars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const json = await res.json()
        setLocalPillars(localPillars.map((x) => (x.id === id ? json.data : x)))
      }
    } else {
      const res = await fetch('/api/social/pillars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const json = await res.json()
        setLocalPillars([...localPillars, json.data])
      }
    }
    setPillarModal(null)
  }

  const deletePillar = async (p: ContentPillar) => {
    const res = await fetch(`/api/social/pillars/${p.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const json = await res.json()
      const ok = confirm(
        `"${p.name}" est utilisé (${json.usage_count} slots, ${json.in_trame_count} cellules).\n\nLe détacher (cellules vidées, slots gardés sans pillar) ?`
      )
      if (!ok) return
      const res2 = await fetch(`/api/social/pillars/${p.id}?mode=detach`, { method: 'DELETE' })
      if (!res2.ok) return
    } else if (!res.ok) return

    setLocalPillars(localPillars.filter((x) => x.id !== p.id))
    const cleanGrid = (g: Record<Weekday, (string | null)[]>) => {
      const out = {} as Record<Weekday, (string | null)[]>
      for (const [k, v] of Object.entries(g)) {
        out[k as Weekday] = v.map((c) => (c === p.id ? null : c))
      }
      return out
    }
    setStoriesGrid(cleanGrid(storiesGrid))
    setPostsGrid(cleanGrid(postsGrid))
  }

  const importTemplate = async () => {
    if (localPillars.length > 0 || hasAnyCellFilled(storiesGrid) || hasAnyCellFilled(postsGrid)) {
      if (!confirm('Cela va créer 15 pillars + remplir les grilles avec le template par défaut.\n\nLes pillars existants seront conservés. Continuer ?')) return
    }
    setImporting(true)
    try {
      // Crée les pillars manquants (par nom)
      const existingNames = new Set(localPillars.map((p) => p.name.toLowerCase()))
      const created: ContentPillar[] = []
      for (const tmpl of DEFAULT_PILLARS) {
        if (existingNames.has(tmpl.name.toLowerCase())) continue
        const res = await fetch('/api/social/pillars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tmpl),
        })
        if (res.ok) {
          const json = await res.json()
          created.push(json.data)
        }
      }
      const allPillars = [...localPillars, ...created]
      setLocalPillars(allPillars)

      const byName = new Map(allPillars.map((p) => [p.name.toLowerCase(), p.id]))
      const lookup = (name: string) => byName.get(name.toLowerCase()) ?? null

      // Stories : 5 slots/jour
      setStoriesPerDay(5)
      const newStories = {} as Record<Weekday, (string | null)[]>
      for (const wd of WEEKDAYS_ORDERED) {
        newStories[wd] = DEFAULT_STORIES[wd].map(lookup)
      }
      setStoriesGrid(newStories)

      // Posts : 2 slots/jour
      setPostsPerDay(2)
      const newPosts = {} as Record<Weekday, (string | null)[]>
      for (const wd of WEEKDAYS_ORDERED) {
        newPosts[wd] = DEFAULT_POSTS[wd].map((n) => (n ? lookup(n) : null))
      }
      setPostsGrid(newPosts)
    } finally {
      setImporting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/social/trame', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stories_grid: storiesGrid,
          posts_grid: postsGrid,
          stories_per_day: storiesPerDay,
          posts_per_day: postsPerDay,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json.error))
      }
      onSaved()
    } catch (e) {
      alert(`Erreur sauvegarde : ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#a78bfa" /> Ma trame de contenu
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Définis ton pattern hebdomadaire — il sera utilisé pour générer automatiquement les slots du mois.
            </p>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <div style={bodyStyle}>
          {/* Pillars library */}
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={sectionTitleStyle}>Bibliothèque de pillars</h3>
              <button
                onClick={importTemplate}
                disabled={importing}
                style={templateBtnStyle(importing)}
              >
                <Wand2 size={12} />
                {importing ? 'Import…' : 'Template par défaut'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {localPillars.map((p) => (
                <PillarChip key={p.id} pillar={p} onEdit={() => setPillarModal({ mode: 'edit', pillar: p })} onDelete={() => deletePillar(p)} />
              ))}
              <button
                onClick={() => setPillarModal({ mode: 'create' })}
                style={addBtnStyle}
              >
                <Plus size={12} /> Ajouter
              </button>
              {localPillars.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center', marginLeft: 6 }}>
                  Crée tes pillars un par un, ou clique <strong>Template par défaut</strong> pour démarrer rapidement.
                </p>
              )}
            </div>
          </section>

          {/* Stories grid */}
          <Section
            title="Stories quotidiennes"
            emoji="📱"
            perDay={storiesPerDay}
            onPerDayChange={updateStoriesPerDay}
            maxPerDay={10}
          >
            <Grid
              perDay={storiesPerDay}
              prefix="Story"
              grid={storiesGrid}
              pillars={localPillars}
              onCellClick={(wd, idx) => setActivePicker({ kind: 'story', wd, idx })}
              onCellClear={(wd, idx) => setStoryCell(wd, idx, null)}
              activePicker={activePicker?.kind === 'story' ? activePicker : null}
              onPick={(pid) => {
                if (activePicker?.kind === 'story') setStoryCell(activePicker.wd, activePicker.idx, pid)
                setActivePicker(null)
              }}
              onPickerClose={() => setActivePicker(null)}
            />
          </Section>

          {/* Posts grid */}
          <Section
            title="Posts quotidiens"
            emoji="📰"
            perDay={postsPerDay}
            onPerDayChange={updatePostsPerDay}
            maxPerDay={5}
          >
            <Grid
              perDay={postsPerDay}
              prefix="Post"
              grid={postsGrid}
              pillars={localPillars}
              onCellClick={(wd, idx) => setActivePicker({ kind: 'post', wd, idx })}
              onCellClear={(wd, idx) => setPostCell(wd, idx, null)}
              activePicker={activePicker?.kind === 'post' ? activePicker : null}
              onPick={(pid) => {
                if (activePicker?.kind === 'post') setPostCell(activePicker.wd, activePicker.idx, pid)
                setActivePicker(null)
              }}
              onPickerClose={() => setActivePicker(null)}
            />
          </Section>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Click sur une cellule pour assigner un pillar — vide = pas de slot ce jour-là
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={saveBtnStyle(saving)}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>

        {pillarModal && (
          <PillarModal
            mode={pillarModal.mode}
            pillar={pillarModal.pillar}
            onClose={() => setPillarModal(null)}
            onSave={(data) => upsertPillar(data, pillarModal.pillar?.id)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Pillar chip ─────────────────────────────────────────────

function PillarChip({ pillar, onEdit, onDelete }: { pillar: ContentPillar; onEdit: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onEdit}
      title="Cliquer pour modifier"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: pillar.color + '22',
        border: `1px solid ${pillar.color}55`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: pillar.color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pillar.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Supprimer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, marginLeft: 2,
          background: hover ? 'rgba(239,68,68,0.15)' : 'transparent',
          border: 'none', borderRadius: '50%',
          color: hover ? '#ef4444' : 'var(--text-tertiary)',
          cursor: 'pointer', padding: 0,
          opacity: hover ? 1 : 0.4,
          transition: 'all 0.15s',
        }}
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Pillar create/edit modal ───────────────────────────────

function PillarModal({ mode, pillar, onClose, onSave }: {
  mode: 'create' | 'edit'
  pillar?: ContentPillar
  onClose: () => void
  onSave: (data: { name: string; color: string }) => void
}) {
  const [name, setName] = useState(pillar?.name ?? '')
  const [color, setColor] = useState(pillar?.color ?? PALETTE[0])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), color })
  }

  return (
    <div style={{ ...overlayStyle, zIndex: 110 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)', background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)', borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {mode === 'create' ? 'Nouveau pillar' : 'Modifier le pillar'}
          </h3>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <label style={labelStyle}>Nom</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="ex: Viral, Lead Magnet, Avant/Après…"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Couleur</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: c,
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 1,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Preview */}
          <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: color + '22',
              border: `1px solid ${color}55`,
              borderRadius: 999,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{name || 'Aperçu'}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button onClick={handleSubmit} disabled={!name.trim()} style={saveBtnStyle(false, !name.trim())}>
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────

function Section({ title, emoji, perDay, onPerDayChange, maxPerDay, children }: {
  title: string
  emoji: string
  perDay: number
  onPerDayChange: (n: number) => void
  maxPerDay: number
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{emoji}</span> {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Slots / jour :</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-secondary)', borderRadius: 6, padding: 2 }}>
            <button
              onClick={() => onPerDayChange(Math.max(0, perDay - 1))}
              style={stepperBtnStyle}
            >−</button>
            <span style={{ minWidth: 24, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{perDay}</span>
            <button
              onClick={() => onPerDayChange(Math.min(maxPerDay, perDay + 1))}
              style={stepperBtnStyle}
            >+</button>
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Grid ────────────────────────────────────────────────────

function Grid({
  perDay, prefix, grid, pillars,
  onCellClick, onCellClear,
  activePicker, onPick, onPickerClose,
}: {
  perDay: number
  prefix: string
  grid: Record<Weekday, (string | null)[]>
  pillars: ContentPillar[]
  onCellClick: (wd: Weekday, idx: number) => void
  onCellClear: (wd: Weekday, idx: number) => void
  activePicker: { wd: Weekday; idx: number } | null
  onPick: (pillarId: string | null) => void
  onPickerClose: () => void
}) {
  if (perDay === 0) {
    return <div style={emptyStateStyle}>Aucun slot configuré pour ce type.</div>
  }

  const cols = `90px repeat(${perDay}, minmax(120px, 1fr))`

  return (
    <div style={{ overflowX: 'auto', background: 'var(--bg-secondary)', borderRadius: 10, padding: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, minWidth: 90 + perDay * 130 }}>
        <div />
        {Array.from({ length: perDay }).map((_, i) => (
          <div key={i} style={colHeaderStyle}>
            {prefix} {i + 1}
          </div>
        ))}
        {WEEKDAYS_ORDERED.map((wd) => (
          <div key={wd} style={{ display: 'contents' }}>
            <div style={rowHeaderStyle}>
              {WEEKDAY_LABELS[wd].slice(0, 3)}
            </div>
            {Array.from({ length: perDay }).map((_, idx) => {
              const pid = grid[wd][idx]
              const p = pid ? pillars.find((x) => x.id === pid) : null
              const isActive = activePicker?.wd === wd && activePicker?.idx === idx
              return (
                <div key={idx} style={{ position: 'relative' }}>
                  <button
                    onClick={() => isActive ? onPickerClose() : onCellClick(wd, idx)}
                    style={{
                      width: '100%', minHeight: 36,
                      padding: '6px 10px', fontSize: 11, fontWeight: 600,
                      color: p ? '#fff' : 'var(--text-tertiary)',
                      background: p ? p.color : 'var(--bg-primary)',
                      border: `1px solid ${p ? p.color : 'var(--border-primary)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 4,
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                      {p?.name ?? '+'}
                    </span>
                    {p && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onCellClear(wd, idx) }}
                        style={{ display: 'flex', opacity: 0.7, padding: 1 }}
                      >
                        <X size={10} />
                      </span>
                    )}
                  </button>
                  {isActive && (
                    <CellPicker
                      pillars={pillars}
                      currentId={pid}
                      onPick={onPick}
                      onClose={onPickerClose}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function CellPicker({ pillars, currentId, onPick, onClose }: {
  pillars: ContentPillar[]
  currentId: string | null
  onPick: (id: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 4,
        minWidth: 180, maxHeight: 260, overflowY: 'auto',
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 20, padding: 4,
      }}
    >
      {pillars.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Pas de pillar — ajoute en un dans la bibliothèque.
        </div>
      ) : (
        <>
          {pillars.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', fontSize: 12, fontWeight: 600,
                color: 'var(--text-primary)',
                background: currentId === p.id ? p.color + '22' : 'transparent',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
              {p.name}
            </button>
          ))}
          {currentId && (
            <>
              <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }} />
              <button
                onClick={() => onPick(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '7px 10px', fontSize: 11, fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <X size={11} /> Vider la cellule
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const modalStyle: React.CSSProperties = {
  width: 'min(1100px, 95vw)', maxHeight: '92vh',
  background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
  borderRadius: 14, display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
}
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '20px 24px', borderBottom: '1px solid var(--border-primary)',
}
const bodyStyle: React.CSSProperties = {
  overflowY: 'auto', padding: 24, flex: 1,
}
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 24px', borderTop: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
}
const chipActionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', padding: 2, borderRadius: 4,
}
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 12px', fontSize: 12, fontWeight: 600,
  background: 'transparent', border: '1px dashed var(--border-primary)',
  borderRadius: 999, color: 'var(--text-tertiary)', cursor: 'pointer',
}
const colHeaderStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
  textAlign: 'center', padding: '6px 4px', textTransform: 'uppercase', letterSpacing: 0.4,
}
const rowHeaderStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  padding: 10, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
}
const stepperBtnStyle: React.CSSProperties = {
  width: 22, height: 22, fontSize: 13, fontWeight: 700,
  background: 'transparent', border: 'none', borderRadius: 4,
  color: 'var(--text-secondary)', cursor: 'pointer',
}
const emptyStateStyle: React.CSSProperties = {
  padding: 20, textAlign: 'center',
  color: 'var(--text-tertiary)', fontSize: 12,
  background: 'var(--bg-secondary)', borderRadius: 8,
}
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const templateBtnStyle = (loading: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', fontSize: 11, fontWeight: 600,
  color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)',
  border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: 6,
  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
})
const saveBtnStyle = (saving: boolean, disabled = false): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: disabled ? '#4b5563' : '#a78bfa',
  border: 'none', borderRadius: 6,
  cursor: saving || disabled ? 'not-allowed' : 'pointer',
  opacity: saving ? 0.7 : 1,
})
