'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
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

const PALETTE = ['#3b82f6', '#a78bfa', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#8b5cf6']

function emptyGrid(perDay: number): Record<Weekday, (string | null)[]> {
  const out = {} as Record<Weekday, (string | null)[]>
  for (const wd of WEEKDAYS_ORDERED) {
    out[wd] = Array(perDay).fill(null)
  }
  return out
}

function normalizeGrid(
  grid: Record<Weekday, (string | null)[]> | undefined,
  perDay: number
): Record<Weekday, (string | null)[]> {
  const out = {} as Record<Weekday, (string | null)[]>
  for (const wd of WEEKDAYS_ORDERED) {
    const arr = grid?.[wd] ?? []
    const fixed = arr.slice(0, perDay)
    while (fixed.length < perDay) fixed.push(null)
    out[wd] = fixed
  }
  return out
}

export default function TrameEditorModal({ trame, pillars, onClose, onSaved }: Props) {
  const [storiesPerDay, setStoriesPerDay] = useState(trame?.stories_per_day ?? 5)
  const [postsPerDay, setPostsPerDay] = useState(trame?.posts_per_day ?? 2)
  const [storiesGrid, setStoriesGrid] = useState<Record<Weekday, (string | null)[]>>(
    () => normalizeGrid(trame?.stories_grid, trame?.stories_per_day ?? 5)
  )
  const [postsGrid, setPostsGrid] = useState<Record<Weekday, (string | null)[]>>(
    () => normalizeGrid(trame?.posts_grid, trame?.posts_per_day ?? 2)
  )
  const [localPillars, setLocalPillars] = useState<ContentPillar[]>(pillars)
  const [saving, setSaving] = useState(false)

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

  const addPillar = async () => {
    const name = prompt('Nom du pillar (ex: Viral, Lead Magnet, Avant/Après) ?')
    if (!name) return
    const color = PALETTE[localPillars.length % PALETTE.length]
    const res = await fetch('/api/social/pillars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (res.ok) {
      const json = await res.json()
      setLocalPillars([...localPillars, json.data])
    } else {
      alert('Erreur création pillar')
    }
  }

  const renamePillar = async (p: ContentPillar) => {
    const name = prompt('Nouveau nom ?', p.name)
    if (!name || name === p.name) return
    const res = await fetch(`/api/social/pillars/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const json = await res.json()
      setLocalPillars(localPillars.map((x) => (x.id === p.id ? json.data : x)))
    }
  }

  const deletePillar = async (p: ContentPillar) => {
    if (!confirm(`Supprimer le pillar "${p.name}" ?`)) return
    const res = await fetch(`/api/social/pillars/${p.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const json = await res.json()
      const choice = confirm(
        `Ce pillar est utilisé (${json.usage_count} slots, ${json.in_trame_count} cellules de trame).\n\n` +
        `OK = détacher (cellules vidées, slots gardés sans pillar)\nAnnuler = ne pas supprimer`
      )
      if (!choice) return
      const res2 = await fetch(`/api/social/pillars/${p.id}?mode=detach`, { method: 'DELETE' })
      if (res2.ok) {
        setLocalPillars(localPillars.filter((x) => x.id !== p.id))
        // clean local grids
        const clean = (g: Record<Weekday, (string | null)[]>) => {
          const out = {} as Record<Weekday, (string | null)[]>
          for (const [k, v] of Object.entries(g)) {
            out[k as Weekday] = v.map((c) => (c === p.id ? null : c))
          }
          return out
        }
        setStoriesGrid(clean(storiesGrid))
        setPostsGrid(clean(postsGrid))
      }
      return
    }
    if (res.ok) {
      setLocalPillars(localPillars.filter((x) => x.id !== p.id))
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
        throw new Error(JSON.stringify(json.error))
      }
      onSaved()
    } catch (e) {
      alert(`Erreur sauvegarde : ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-primary)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Ma trame de contenu</h2>
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
          {/* Pillars library */}
          <section style={{ marginBottom: 32 }}>
            <h3 style={sectionTitleStyle}>Bibliothèque de pillars</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {localPillars.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 999 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  <button onClick={() => renamePillar(p)} style={{ ...inlineBtnStyle, fontSize: 12, fontWeight: 600 }}>{p.name}</button>
                  <button onClick={() => deletePillar(p)} style={{ ...inlineBtnStyle, color: '#ef4444', display: 'flex' }}><Trash2 size={12} /></button>
                </div>
              ))}
              <button
                onClick={addPillar}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'transparent', border: '1px dashed var(--border-primary)', borderRadius: 999, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={12} /> Ajouter
              </button>
            </div>
          </section>

          {/* Stories grid */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={sectionTitleStyle}>📱 Stories quotidiennes</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Slots / jour :</span>
                <input
                  type="number" min={0} max={10}
                  value={storiesPerDay}
                  onChange={(e) => updateStoriesPerDay(Number(e.target.value))}
                  style={numInputStyle}
                />
              </div>
            </div>
            <Grid
              perDay={storiesPerDay}
              prefix="S"
              grid={storiesGrid}
              pillars={localPillars}
              onChange={setStoryCell}
            />
          </section>

          {/* Posts grid */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={sectionTitleStyle}>📰 Posts quotidiens</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Slots / jour :</span>
                <input
                  type="number" min={0} max={5}
                  value={postsPerDay}
                  onChange={(e) => updatePostsPerDay(Number(e.target.value))}
                  style={numInputStyle}
                />
              </div>
            </div>
            <Grid
              perDay={postsPerDay}
              prefix="P"
              grid={postsGrid}
              pillars={localPillars}
              onChange={setPostCell}
            />
          </section>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--border-primary)' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={saveBtnStyle(saving)}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Grid({
  perDay, prefix, grid, pillars, onChange,
}: {
  perDay: number
  prefix: string
  grid: Record<Weekday, (string | null)[]>
  pillars: ContentPillar[]
  onChange: (wd: Weekday, idx: number, pillarId: string | null) => void
}) {
  if (perDay === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>Aucun slot configuré.</div>
  }

  const cols = `100px repeat(${perDay}, minmax(110px, 1fr))`

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 4, minWidth: 100 + perDay * 110 }}>
        <div />
        {Array.from({ length: perDay }).map((_, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center', padding: 6 }}>
            {prefix}{i + 1}
          </div>
        ))}
        {WEEKDAYS_ORDERED.map((wd) => (
          <div key={wd} style={{ display: 'contents' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: 8, alignSelf: 'center' }}>
              {WEEKDAY_LABELS[wd]}
            </div>
            {Array.from({ length: perDay }).map((_, idx) => {
              const pid = grid[wd][idx]
              const p = pid ? pillars.find((x) => x.id === pid) : null
              return (
                <select
                  key={idx}
                  value={pid ?? ''}
                  onChange={(e) => onChange(wd, idx, e.target.value || null)}
                  style={{
                    padding: '8px 10px', fontSize: 11, fontWeight: 600,
                    color: p ? '#fff' : 'var(--text-tertiary)',
                    background: p ? p.color : 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)', borderRadius: 6,
                    cursor: 'pointer', appearance: 'none',
                    width: '100%',
                  }}
                >
                  <option value="" style={{ color: '#000', background: '#fff' }}>—</option>
                  {pillars.map((px) => (
                    <option key={px.id} value={px.id} style={{ color: '#000', background: '#fff' }}>
                      {px.name}
                    </option>
                  ))}
                </select>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100,
}
const modalStyle: React.CSSProperties = {
  width: 'min(1100px, 95vw)', maxHeight: '90vh',
  background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
  borderRadius: 12, display: 'flex', flexDirection: 'column',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
}
const inlineBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-primary)', padding: 0,
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const numInputStyle: React.CSSProperties = {
  width: 50, padding: '4px 6px', fontSize: 12,
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 6,
}
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-primary)', borderRadius: 6,
  cursor: 'pointer',
}
const saveBtnStyle = (saving: boolean): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6,
  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
})
