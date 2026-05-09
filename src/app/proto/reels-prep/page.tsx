'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../proto.module.css'

interface Phrase {
  id: string
  text: string
  location: string | null
  aiSuggested: string | null
  done: boolean
  skipped?: boolean  // marqué "à reporter" en jour J
  shotNote?: string  // notes de cadrage / action (ex: "gros plan visage", "pointer la barre")
}

interface Reel {
  id: string
  title: string
  hook: string
  phrases: Phrase[]
}

interface PrepState {
  reels: Reel[]
  locations: string[]
  filter: 'all' | 'unplaced' | 'placed'
  search: string
  collapsedReels: Record<string, boolean>
  aiApplied: boolean
}

const STORAGE_KEY = 'closrm-reels-prep-v0'

function defaultState(): PrepState {
  const reelTopics = [
    {
      title: 'Dos large en 3 exos',
      hook: 'Le truc que personne dit pour avoir un dos en V',
      phrases: [
        { text: "Le truc qui change tout c'est de descendre lentement à la poulie", suggested: 'Poulie' },
        { text: 'Vraiment lentement, genre 4 secondes', suggested: null },
        { text: 'Sur le banc tu vois la barre, tu la fixes pas', suggested: 'Banc plat' },
        { text: 'Là tu vas sentir le brûler dans le grand dorsal en tirant', suggested: 'Poulie' },
        { text: "La position de départ c'est genoux fléchis au sol", suggested: 'Sol' },
        { text: "Et tu vois ton dos s'élargir devant le miroir", suggested: 'Devant le miroir' },
      ],
    },
    {
      title: 'Pull-over technique',
      hook: "L'exo que tout le monde fait mal",
      phrases: [
        { text: "L'erreur la plus fréquente c'est de plier les coudes sur le banc", suggested: 'Banc plat' },
        { text: 'La vraie technique : bras quasi tendus à la poulie', suggested: 'Poulie' },
        { text: "Et là tu sens ton dos qui s'étire au sol", suggested: 'Sol' },
      ],
    },
    {
      title: 'Routine cardio matin',
      hook: '15 min pour réveiller le métabolisme',
      phrases: [
        { text: "Première chose le matin : 1 verre d'eau devant le miroir", suggested: 'Devant le miroir' },
        { text: 'Puis 20 burpees au sol', suggested: 'Sol' },
        { text: 'Et on finit par 10 tractions à la poulie', suggested: 'Poulie' },
      ],
    },
  ]
  const reels: Reel[] = reelTopics.map((t, i) => ({
    id: `r${i}`,
    title: t.title,
    hook: t.hook,
    phrases: t.phrases.map((p, j) => ({
      id: `r${i}-p${j}`,
      text: p.text,
      location: null,
      aiSuggested: p.suggested,
      done: false,
    })),
  }))
  return {
    reels,
    locations: ['Poulie', 'Banc plat', 'Sol', 'Devant le miroir'],
    filter: 'all',
    search: '',
    collapsedReels: {},
    aiApplied: false,
  }
}

function placeIcon(loc: string | null): string {
  if (!loc) return '📍'
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  if (l.includes('plage') || l.includes('extér') || l.includes('dehors')) return '🌳'
  return '📍'
}

export default function PrepTournagePage() {
  const searchParams = useSearchParams()
  const reelParam = searchParams.get('reel')
  const [state, setState] = useState<PrepState | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) {
      try { setState(JSON.parse(raw)); return } catch {}
    }
    setState(defaultState())
  }, [])

  useEffect(() => {
    if (state && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  useEffect(() => {
    const onClick = () => setOpenDropdown(null)
    if (openDropdown) {
      const t = setTimeout(() => document.addEventListener('click', onClick), 50)
      return () => { clearTimeout(t); document.removeEventListener('click', onClick) }
    }
  }, [openDropdown])

  const visibleReels = useMemo(() => {
    if (!state) return []
    if (reelParam) return state.reels.filter(r => r.id === reelParam)
    return state.reels
  }, [state, reelParam])

  const totals = useMemo(() => {
    let total = 0, placed = 0
    visibleReels.forEach(r => r.phrases.forEach(p => { total++; if (p.location) placed++ }))
    return { total, placed }
  }, [visibleReels])

  if (!state) return <div style={{ padding: 40, color: '#888', background: '#0a0a0a', minHeight: '100vh' }}>Chargement…</div>

  function update(fn: (s: PrepState) => PrepState) {
    setState(prev => prev ? fn(prev) : prev)
  }

  function setPhraseLocation(reelId: string, phraseId: string, location: string | null) {
    update(s => ({
      ...s,
      reels: s.reels.map(r => r.id === reelId ? {
        ...r,
        phrases: r.phrases.map(p => p.id === phraseId ? { ...p, location } : p),
      } : r),
      locations: location && !s.locations.includes(location) ? [...s.locations, location] : s.locations,
    }))
  }

  function aiSuggestAll() {
    update(s => {
      let count = 0
      const reels = s.reels.map(r => ({
        ...r,
        phrases: r.phrases.map(p => {
          if (!p.location && p.aiSuggested) { count++; return { ...p, location: p.aiSuggested } }
          return p
        }),
      }))
      setTimeout(() => alert(`✨ IA a placé ${count} phrase(s).`), 50)
      return { ...s, reels, aiApplied: true }
    })
  }

  function batchAssign(location: string | null) {
    update(s => ({
      ...s,
      reels: s.reels.map(r => ({
        ...r,
        phrases: r.phrases.map(p => selectedIds.includes(p.id) ? { ...p, location } : p),
      })),
      locations: location && !s.locations.includes(location) ? [...s.locations, location] : s.locations,
    }))
    setSelectedIds([])
  }

  function addLocation() {
    const name = prompt('Nom du nouveau lieu :')
    if (name && name.trim()) update(s => ({ ...s, locations: [...s.locations, name.trim()] }))
  }

  function clearAll() {
    if (!confirm('Vider toutes les assignations ?')) return
    update(s => ({
      ...s,
      reels: s.reels.map(r => ({ ...r, phrases: r.phrases.map(p => ({ ...p, location: null })) })),
      aiApplied: false,
    }))
  }

  function resetAll() {
    if (!confirm('Reset complet (regénère 3 reels demo) ?')) return
    setState(defaultState())
    setSelectedIds([])
  }

  function toggleSelected(id: string) {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#e5e5e5' }}>
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
          borderRadius: 10, padding: '14px 18px', marginBottom: 16,
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF0000', minWidth: 32 }}>📋</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 2 }}>
              {reelParam ? 'Préparer ce reel' : 'Préparer mon tournage'} — V0 PROTO
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {reelParam
                ? 'Filtré sur 1 reel uniquement. '
                : 'Tous tes reels. '}
              localStorage seul, bypass auth. {reelParam && (
                <Link href="/proto/reels-prep" style={{ color: '#FF0000', textDecoration: 'underline' }}>
                  Voir tous les reels →
                </Link>
              )}
            </div>
          </div>
          <Link href="/proto/reels-jour-j" style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#FF0000', background: 'rgba(255,0,0,0.08)',
            border: '1px solid rgba(255,0,0,0.25)', borderRadius: 8, textDecoration: 'none',
          }}>🎬 Jour J →</Link>
        </div>

        <div style={{
          background: '#141414', border: '1px solid #262626', borderRadius: 10,
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <button onClick={aiSuggestAll} style={{
            padding: '9px 16px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>✨ {state.aiApplied ? 'Re-suggérer' : 'Suggérer auto (IA)'}</button>
          <button onClick={addLocation} style={btnSecondary}>+ Lieu</button>
          <button onClick={clearAll} style={btnSecondary}>↻ Vider</button>
          <button onClick={resetAll} style={{ ...btnSecondary, color: '#E53E3E', borderColor: '#3a1a1a' }}>↻ Reset demo</button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
            {totals.placed} / {totals.total} placées · <b style={{ color: '#fff' }}>{totals.total - totals.placed}</b> restantes
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', flexWrap: 'wrap', marginBottom: 8 }}>
          {(['all', 'unplaced', 'placed'] as const).map(f => {
            const labels = { all: 'Toutes', unplaced: '🔴 Non placées', placed: '✓ Placées' }
            const isActive = state.filter === f
            return (
              <button key={f}
                onClick={() => update(s => ({ ...s, filter: f }))}
                style={{
                  padding: '6px 12px',
                  background: isActive ? '#FF0000' : '#141414',
                  border: `1px solid ${isActive ? '#FF0000' : '#262626'}`,
                  borderRadius: 99, fontSize: 11,
                  color: isActive ? '#fff' : '#888', cursor: 'pointer',
                }}>{labels[f]}</button>
            )
          })}
          <input
            placeholder="🔎 Rechercher dans les phrases…"
            value={state.search}
            onChange={e => update(s => ({ ...s, search: e.target.value }))}
            style={{
              flex: 1, minWidth: 200, maxWidth: 320,
              padding: '8px 12px', background: '#141414', border: '1px solid #262626',
              borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
            }}
          />
        </div>

        {visibleReels.map(reel => {
          const isCollapsed = !!state.collapsedReels[reel.id]
          let phrases = reel.phrases
          if (state.filter === 'unplaced') phrases = phrases.filter(p => !p.location)
          if (state.filter === 'placed') phrases = phrases.filter(p => p.location)
          if (state.search) {
            const s = state.search.toLowerCase()
            phrases = phrases.filter(p => p.text.toLowerCase().includes(s))
          }
          if (phrases.length === 0) return null

          const placedCount = reel.phrases.filter(p => p.location).length
          const total = reel.phrases.length
          const pct = total ? (placedCount / total) * 100 : 0

          return (
            <div key={reel.id} style={{
              background: '#141414', border: '1px solid #262626', borderRadius: 10,
              marginBottom: 10, overflow: 'hidden',
            }}>
              <div
                onClick={() => update(s => ({ ...s, collapsedReels: { ...s.collapsedReels, [reel.id]: !isCollapsed } }))}
                style={{
                  padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                  background: '#1a1a1a', borderBottom: isCollapsed ? 'none' : '1px solid #262626',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#666', fontSize: 11 }}>{isCollapsed ? '▸' : '▾'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{reel.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 11, color: '#888' }}>{placedCount} / {total} placées</span>
                  <div style={{ width: 60, height: 4, background: '#262626', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#38A169', transition: 'width 0.2s' }} />
                  </div>
                </div>
              </div>

              {!isCollapsed && (
                <div style={{ padding: '4px 0' }}>
                  {phrases.map(p => {
                    const isSelected = selectedIds.includes(p.id)
                    const showAi = p.aiSuggested && !p.location && state.aiApplied === false
                    const display = p.location
                    return (
                      <div key={p.id} className={styles.phraseRow} style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid #1a1a1a',
                        background: isSelected ? 'rgba(255,0,0,0.06)' : 'transparent',
                        fontSize: 13,
                      }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(p.id)}
                          style={{ width: 16, height: 16, accentColor: '#FF0000' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            color: p.location ? '#fff' : '#ccc', lineHeight: 1.4,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            <span style={{ color: '#555', fontSize: 11, marginRight: 6 }}>
                              {reel.phrases.indexOf(p) + 1}/{reel.phrases.length}
                            </span>
                            {p.text}
                          </div>
                          <input
                            type="text"
                            placeholder="🎥 Cadrage / action (optionnel) — ex: gros plan visage, pointer la barre…"
                            value={p.shotNote ?? ''}
                            onClick={e => e.stopPropagation()}
                            onChange={e => update(s => ({
                              ...s,
                              reels: s.reels.map(r => r.id === reel.id ? {
                                ...r,
                                phrases: r.phrases.map(pp => pp.id === p.id ? { ...pp, shotNote: e.target.value } : pp),
                              } : r),
                            }))}
                            style={{
                              width: '100%', marginTop: 4,
                              padding: '4px 8px', background: 'transparent', border: 'none',
                              borderBottom: '1px dashed #262626',
                              color: '#888', fontSize: 11, outline: 'none', fontStyle: 'italic',
                            }}
                          />
                        </div>

                        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenDropdown(openDropdown === p.id ? null : p.id)}
                            style={{
                              width: '100%', padding: '7px 10px',
                              background: '#0a0a0a',
                              border: `1px ${display ? 'solid' : 'dashed'} ${showAi ? 'rgba(139,92,246,0.4)' : '#262626'}`,
                              borderRadius: 7, color: display ? '#fff' : '#555', fontSize: 12,
                              cursor: 'pointer', textAlign: 'left',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            <span>{placeIcon(display)}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {display || (showAi ? `✨ ${p.aiSuggested} (IA)` : 'Choisir un lieu')}
                            </span>
                            <span style={{ opacity: 0.4, fontSize: 9 }}>▾</span>
                          </button>

                          {openDropdown === p.id && (
                            <PlaceDropdown
                              phrase={p}
                              locations={state.locations}
                              onPick={(loc) => { setPhraseLocation(reel.id, p.id, loc); setOpenDropdown(null) }}
                              onClose={() => setOpenDropdown(null)}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {selectedIds.length > 0 && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#141414', border: '1px solid #FF0000', borderRadius: 12,
            padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
            boxShadow: '0 12px 40px rgba(255,0,0,0.2)', zIndex: 50,
          }}>
            <span style={{ color: '#FF0000', fontWeight: 700, fontSize: 13 }}>
              {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#888', fontSize: 12 }}>→ assigner à :</span>
            <select
              onChange={e => {
                const v = e.target.value
                if (!v) return
                batchAssign(v === '__clear__' ? null : v)
                e.target.value = ''
              }}
              style={{
                padding: '7px 10px', background: '#0a0a0a', border: '1px solid #262626',
                borderRadius: 7, color: '#fff', fontSize: 12, outline: 'none',
              }}>
              <option value="">Choisir lieu…</option>
              {state.locations.map(l => <option key={l} value={l}>{l}</option>)}
              <option value="__clear__">↻ Retirer le lieu</option>
            </select>
            <button onClick={() => setSelectedIds([])} style={btnSecondary}>✕ Désélectionner</button>
          </div>
        )}
      </div>
    </div>
  )
}

function PlaceDropdown({
  phrase, locations, onPick, onClose,
}: {
  phrase: Phrase; locations: string[];
  onPick: (loc: string | null) => void; onClose: () => void
}) {
  const [filter, setFilter] = useState('')
  const filtered = locations.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
  const exactMatch = filtered.some(l => l.toLowerCase() === filter.toLowerCase())

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
      background: '#141414', border: '1px solid #262626', borderRadius: 8,
      overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
      zIndex: 100, maxHeight: 280, overflowY: 'auto',
    }}>
      <input
        autoFocus
        placeholder="Filtrer ou créer un lieu…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && filter.trim()) onPick(filter.trim())
        }}
        style={{
          width: '100%', padding: '8px 10px', background: '#0a0a0a', border: 'none',
          borderBottom: '1px solid #262626', color: '#fff', fontSize: 12, outline: 'none',
        }}
      />
      {filtered.map(loc => (
        <div key={loc} onClick={() => onPick(loc)} style={ddItem}>
          <span>{placeIcon(loc)}</span><span>{loc}</span>
        </div>
      ))}
      {filter && !exactMatch && (
        <div onClick={() => onPick(filter.trim())} style={{ ...ddItem, color: '#38A169', fontWeight: 600 }}>
          <span>+</span><span>Créer &laquo; {filter} &raquo;</span>
        </div>
      )}
      {phrase.aiSuggested && phrase.location !== phrase.aiSuggested && (
        <div onClick={() => onPick(phrase.aiSuggested)} style={{ ...ddItem, color: '#8b5cf6', fontWeight: 600 }}>
          <span>✨</span><span>Suggestion IA : {phrase.aiSuggested}</span>
        </div>
      )}
      {phrase.location && (
        <div onClick={() => onPick(null)} style={{ ...ddItem, color: '#888', borderTop: '1px solid #262626' }}>
          <span>↻</span><span>Retirer le lieu</span>
        </div>
      )}
    </div>
  )
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', background: 'transparent', color: '#888',
  border: '1px solid #262626', borderRadius: 8, fontSize: 12, cursor: 'pointer',
}

const ddItem: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12, color: '#ccc', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
}
