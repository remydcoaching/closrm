'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ReelShot {
  id: string
  workspace_id: string
  social_post_id: string
  position: number
  text: string
  location: string | null
  shot_note: string | null
  done: boolean
  skipped: boolean
  ai_suggested_location: string | null
}

interface SocialPost {
  id: string
  title: string | null
  hook: string | null
  script: string | null
  content_kind: string | null
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

export default function PrepTournagePageWrapper() {
  return <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>Chargement…</div>}><PrepView /></Suspense>
}

interface PrepViewProps {
  embedded?: boolean
  reelParamProp?: string | null
  onClose?: () => void
  onNavigate?: (url: string) => void
  onSwitchView?: (view: 'jour-j' | 'brief') => void
}

export function PrepView({ embedded, reelParamProp, onClose, onNavigate, onSwitchView }: PrepViewProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reelParam = embedded ? (reelParamProp ?? null) : searchParams.get('reel')

  const navigate = useCallback((url: string) => {
    if (embedded && onNavigate) onNavigate(url)
    else router.push(url)
  }, [embedded, onNavigate, router])

  const [reels, setReels] = useState<SocialPost[]>([])
  const [allReels, setAllReels] = useState<SocialPost[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [shots, setShots] = useState<ReelShot[]>([])
  const [knownLocations, setKnownLocations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<'all' | 'unplaced' | 'placed'>('all')
  const [search, setSearch] = useState('')
  const [collapsedReels, setCollapsedReels] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const reelIds = useMemo(() => {
    if (!reelParam) return null
    return reelParam.split(',').map(s => s.trim()).filter(Boolean)
  }, [reelParam])

  // Charge les reels + shots + locations
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Reels
      const reelsRes = await fetch('/api/social/posts?content_kind=reel&slim=true&per_page=100')
      if (!reelsRes.ok) throw new Error(`Reels fetch failed: ${reelsRes.status}`)
      const reelsJson = await reelsRes.json()
      const allFetched: SocialPost[] = reelsJson.data ?? []
      setAllReels(allFetched)
      const filtered = reelIds ? allFetched.filter(r => reelIds.includes(r.id)) : allFetched
      setReels(filtered)

      // 2. Sync les shots des reels visibles (split script → reel_shots)
      await Promise.all(filtered.map(r =>
        fetch('/api/reel-shots/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ social_post_id: r.id }),
        }).catch(() => null)
      ))

      // 3. Charge les shots
      let shotsUrl = '/api/reel-shots'
      if (filtered.length > 0) shotsUrl += `?social_post_ids=${filtered.map(r => r.id).join(',')}`
      const shotsRes = await fetch(shotsUrl)
      if (!shotsRes.ok) throw new Error(`Shots fetch failed: ${shotsRes.status}`)
      const shotsJson = await shotsRes.json()
      setShots(shotsJson.data ?? [])

      // 4. Locations autocomplete
      const locRes = await fetch('/api/reel-shots/locations')
      if (locRes.ok) {
        const locJson = await locRes.json()
        setKnownLocations(locJson.data ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [reelIds])

  useEffect(() => { loadAll() }, [loadAll])

  // Update local + API
  async function updateShot(id: string, patch: Partial<Pick<ReelShot, 'location' | 'shot_note' | 'done' | 'skipped'>>) {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    const res = await fetch(`/api/reel-shots/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      // rollback en cas d'erreur
      loadAll()
    } else if (patch.location && !knownLocations.includes(patch.location)) {
      setKnownLocations(prev => [...prev, patch.location!].sort())
    }
  }

  async function batchUpdate(ids: string[], patch: Partial<Pick<ReelShot, 'location' | 'shot_note' | 'done' | 'skipped'>>) {
    setShots(prev => prev.map(s => ids.includes(s.id) ? { ...s, ...patch } : s))
    const res = await fetch('/api/reel-shots/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, patch }),
    })
    if (!res.ok) {
      loadAll()
    } else if (patch.location && !knownLocations.includes(patch.location)) {
      setKnownLocations(prev => [...prev, patch.location!].sort())
    }
    setSelectedIds([])
  }

  function toggleSelected(id: string) {
    setSelectedIds(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  }

  async function aiSuggest() {
    setAiLoading(true)
    try {
      const body = reels.length > 0 ? { social_post_ids: reels.map(r => r.id) } : {}
      const res = await fetch('/api/reel-shots/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(`Erreur IA : ${json.error ?? res.status}`)
      } else {
        alert(`✨ IA a placé ${json.applied} / ${json.total} phrases.`)
        loadAll()
      }
    } catch (e) {
      alert(`Erreur réseau : ${(e as Error).message}`)
    } finally {
      setAiLoading(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return
    const onClick = () => setOpenDropdown(null)
    const t = setTimeout(() => document.addEventListener('click', onClick), 50)
    return () => { clearTimeout(t); document.removeEventListener('click', onClick) }
  }, [openDropdown])

  const totals = useMemo(() => {
    let total = 0, placed = 0
    shots.forEach(s => { total++; if (s.location) placed++ })
    return { total, placed }
  }, [shots])

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Chargement…</div>
  if (error) return (
    <div style={{ padding: 40, color: '#E53E3E' }}>
      Erreur : {error}
      <button onClick={loadAll} style={{ marginLeft: 12, padding: '6px 12px', background: '#E53E3E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>↻ Réessayer</button>
    </div>
  )

  if (reels.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Aucun reel à préparer</div>
        <div style={{ fontSize: 12 }}>
          Crée d&apos;abord un post avec le type &quot;Reel&quot; depuis le composer.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{
        background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
        borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#FF0000', minWidth: 32 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 2 }}>
            {reelIds ? `Préparer ${reels.length} reel${reels.length > 1 ? 's' : ''}` : 'Préparer mon tournage'}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            Assigne un lieu à chaque phrase.{' '}
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                color: '#FF0000', background: 'transparent', border: 'none',
                textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12,
              }}>
              {reelIds ? `+ Ajouter d'autres reels` : 'Filtrer sur certains reels'}
            </button>
            {reelIds && (
              <>
                {' · '}
                <button
                  onClick={() => navigate('/acquisition/reels/tournage/prep')}
                  style={{
                    color: '#888', background: 'transparent', border: 'none',
                    textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12,
                  }}>
                  Tous les reels
                </button>
              </>
            )}
          </div>
        </div>
        {embedded && onClose && (
          <button onClick={onClose} style={{
            padding: '8px 12px', fontSize: 12, fontWeight: 600,
            color: '#888', background: 'transparent',
            border: '1px solid #262626', borderRadius: 8, cursor: 'pointer',
          }}>← Sessions</button>
        )}
        <NavBtn
          embedded={embedded}
          onSwitchView={onSwitchView}
          target="jour-j"
          href={reelParam ? `/acquisition/reels/tournage/jour-j?reel=${reelParam}` : '/acquisition/reels/tournage/jour-j'}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#FF0000', background: 'rgba(255,0,0,0.08)',
            border: '1px solid rgba(255,0,0,0.25)', borderRadius: 8, textDecoration: 'none', cursor: 'pointer',
          }}
        >🎬 Jour J →</NavBtn>
        <NavBtn
          embedded={embedded}
          onSwitchView={onSwitchView}
          target="brief"
          href={reelParam ? `/acquisition/reels/tournage/brief?reel=${reelParam}` : '/acquisition/reels/tournage/brief'}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#888', background: 'transparent',
            border: '1px solid #262626', borderRadius: 8, textDecoration: 'none', cursor: 'pointer',
          }}
        >📄 Brief</NavBtn>
      </div>

      <div style={{
        background: '#141414', border: '1px solid #262626', borderRadius: 10,
        padding: '12px 14px', marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <button onClick={aiSuggest} disabled={aiLoading} style={{
          padding: '9px 16px', background: aiLoading ? '#3a1a3a' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: aiLoading ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          ✨ {aiLoading ? 'IA en cours…' : 'Suggérer auto (IA)'}
        </button>
        <button onClick={() => setAddingLocation(true)} style={btnSecondary}>+ Lieu</button>
        <button onClick={loadAll} style={btnSecondary}>↻ Recharger</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
          {totals.placed} / {totals.total} placées · <b style={{ color: '#fff' }}>{totals.total - totals.placed}</b> restantes
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', flexWrap: 'wrap', marginBottom: 8 }}>
        {(['all', 'unplaced', 'placed'] as const).map(f => {
          const labels = { all: 'Toutes', unplaced: '🔴 Non placées', placed: '✓ Placées' }
          const isActive = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 12px',
              background: isActive ? '#FF0000' : '#141414',
              border: `1px solid ${isActive ? '#FF0000' : '#262626'}`,
              borderRadius: 99, fontSize: 11,
              color: isActive ? '#fff' : '#888', cursor: 'pointer',
            }}>{labels[f]}</button>
          )
        })}
        <input placeholder="🔎 Rechercher dans les phrases…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, maxWidth: 320,
            padding: '8px 12px', background: '#141414', border: '1px solid #262626',
            borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
          }} />
      </div>

      {reels.map(reel => {
        const reelShots = shots.filter(s => s.social_post_id === reel.id).sort((a, b) => a.position - b.position)
        let visible = reelShots
        if (filter === 'unplaced') visible = visible.filter(s => !s.location)
        if (filter === 'placed') visible = visible.filter(s => s.location)
        if (search) {
          const q = search.toLowerCase()
          visible = visible.filter(s => s.text.toLowerCase().includes(q))
        }
        if (visible.length === 0) return null

        const placedCount = reelShots.filter(s => s.location).length
        const total = reelShots.length
        const pct = total ? (placedCount / total) * 100 : 0
        const isCollapsed = !!collapsedReels[reel.id]

        return (
          <div key={reel.id} style={{
            background: '#141414', border: '1px solid #262626', borderRadius: 10,
            marginBottom: 10, overflow: 'hidden',
          }}>
            <div onClick={() => setCollapsedReels(prev => ({ ...prev, [reel.id]: !isCollapsed }))} style={{
              padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', cursor: 'pointer', userSelect: 'none',
              background: '#1a1a1a', borderBottom: isCollapsed ? 'none' : '1px solid #262626',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#666', fontSize: 11 }}>{isCollapsed ? '▸' : '▾'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{reel.title || '(sans titre)'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 11, color: '#888' }}>{placedCount} / {total} placées</span>
                <div style={{ width: 60, height: 4, background: '#262626', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#38A169' }} />
                </div>
              </div>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '4px 0' }}>
                {visible.map(s => {
                  const isSelected = selectedIds.includes(s.id)
                  return (
                    <div key={s.id} style={{
                      display: 'grid', gridTemplateColumns: '24px 1fr 200px',
                      gap: 12, alignItems: 'center', padding: '8px 16px',
                      borderBottom: '1px solid #1a1a1a',
                      background: isSelected ? 'rgba(255,0,0,0.06)' : 'transparent',
                      fontSize: 13,
                    }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(s.id)}
                        style={{ width: 16, height: 16, accentColor: '#FF0000' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          color: s.location ? '#fff' : '#ccc', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          opacity: s.done ? 0.55 : 1,
                          textDecoration: s.done ? 'line-through' : 'none',
                        }}>
                          <span style={{ color: '#555', fontSize: 11, marginRight: 6 }}>
                            {s.position + 1}/{total}
                          </span>
                          {s.done && (
                            <span title="Phrase déjà tournée"
                              style={{
                                color: '#38A169', marginRight: 6, fontSize: 11, fontWeight: 700,
                              }}>✓ tournée</span>
                          )}
                          {s.skipped && !s.done && (
                            <span title="Reportée à plus tard"
                              style={{
                                color: '#d69e2e', marginRight: 6, fontSize: 11, fontWeight: 700,
                              }}>⏭ reportée</span>
                          )}
                          {s.text}
                          {(s.done || s.skipped) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateShot(s.id, { done: false, skipped: false }) }}
                              title="Réinitialiser le statut (re-tourner)"
                              style={{
                                marginLeft: 8, padding: '0 6px', fontSize: 10,
                                color: '#888', background: 'transparent',
                                border: '1px solid #262626', borderRadius: 4, cursor: 'pointer',
                              }}>↻</button>
                          )}
                        </div>
                        {(s.shot_note || editingNoteId === s.id) ? (
                          <input type="text"
                            autoFocus={editingNoteId === s.id && !s.shot_note}
                            placeholder="Cadrage / action…"
                            defaultValue={s.shot_note ?? ''}
                            onClick={e => e.stopPropagation()}
                            onBlur={(e) => { setEditingNoteId(null); updateShot(s.id, { shot_note: e.target.value || null }) }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                            style={{
                              width: '100%', marginTop: 4,
                              padding: '3px 0', background: 'transparent', border: 'none',
                              color: '#d69e2e', fontSize: 11, outline: 'none', fontStyle: 'italic',
                            }}
                          />
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setEditingNoteId(s.id) }} style={{
                            marginTop: 2, padding: 0, background: 'transparent', border: 'none',
                            color: '#3a3a3a', fontSize: 10, cursor: 'pointer',
                          }}>🎥 + cadrage</button>
                        )}
                      </div>

                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenDropdown(openDropdown === s.id ? null : s.id)} style={{
                          width: '100%', padding: '7px 10px', background: '#0a0a0a',
                          border: `1px ${s.location ? 'solid' : 'dashed'} #262626`,
                          borderRadius: 7, color: s.location ? '#fff' : '#555', fontSize: 12,
                          cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span>{placeIcon(s.location)}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.location || 'Choisir un lieu'}
                          </span>
                          <span style={{ opacity: 0.4, fontSize: 9 }}>▾</span>
                        </button>

                        {openDropdown === s.id && (
                          <PlaceDropdown
                            current={s.location}
                            locations={knownLocations}
                            onPick={(loc) => { updateShot(s.id, { location: loc }); setOpenDropdown(null) }}
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
              batchUpdate(selectedIds, { location: v === '__clear__' ? null : v })
              e.target.value = ''
            }}
            style={{
              padding: '7px 10px', background: '#0a0a0a', border: '1px solid #262626',
              borderRadius: 7, color: '#fff', fontSize: 12, outline: 'none',
            }}>
            <option value="">Choisir lieu…</option>
            {knownLocations.map(l => <option key={l} value={l}>{l}</option>)}
            <option value="__clear__">↻ Retirer le lieu</option>
          </select>
          <button onClick={() => setSelectedIds([])} style={btnSecondary}>✕ Désélectionner</button>
        </div>
      )}

      {pickerOpen && (
        <ReelPicker
          allReels={allReels}
          currentIds={reelIds ?? reels.map(r => r.id)}
          onClose={() => setPickerOpen(false)}
          onConfirm={(ids) => {
            setPickerOpen(false)
            if (ids.length === allReels.length) {
              navigate('/acquisition/reels/tournage/prep')
            } else {
              navigate(`/acquisition/reels/tournage/prep?reel=${ids.join(',')}`)
            }
          }}
        />
      )}

      {addingLocation && (
        <div onClick={() => setAddingLocation(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 360, maxWidth: 'calc(100vw - 32px)',
            background: '#141414', border: '1px solid #262626',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Nouveau lieu</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>
              Ex : Poulie, Banc plat, Devant le miroir, Plage…
            </div>
            <input autoFocus type="text" value={newLocationName}
              onChange={e => setNewLocationName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (newLocationName.trim()) {
                    setKnownLocations(prev => [...prev, newLocationName.trim()].sort())
                    setAddingLocation(false); setNewLocationName('')
                  }
                }
                if (e.key === 'Escape') setAddingLocation(false)
              }}
              placeholder="Nom du lieu…"
              style={{
                width: '100%', padding: '10px 12px',
                background: '#0a0a0a', border: '1px solid #262626',
                borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddingLocation(false)} style={btnSecondary}>Annuler</button>
              <button onClick={() => {
                if (newLocationName.trim()) {
                  setKnownLocations(prev => [...prev, newLocationName.trim()].sort())
                  setAddingLocation(false); setNewLocationName('')
                }
              }} disabled={!newLocationName.trim()} style={{
                padding: '8px 16px', background: newLocationName.trim() ? '#FF0000' : '#3a1a1a',
                color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: newLocationName.trim() ? 'pointer' : 'not-allowed',
              }}>+ Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReelPicker({
  allReels, currentIds, onClose, onConfirm,
}: {
  allReels: SocialPost[]
  currentIds: string[]
  onClose: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds))
  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 80px)',
        background: '#141414', border: '1px solid #262626',
        borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #262626' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Sélectionner les reels à préparer
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {selected.size} sur {allReels.length} sélectionné{selected.size > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
          <button
            onClick={() => setSelected(s => s.size === allReels.length ? new Set() : new Set(allReels.map(r => r.id)))}
            style={{
              width: '100%', padding: '8px 12px', marginBottom: 8,
              background: 'transparent', color: '#888',
              border: '1px dashed #262626', borderRadius: 7, cursor: 'pointer',
              fontSize: 12,
            }}>
            {selected.size === allReels.length ? '☑️ Tout désélectionner' : '☐ Tout sélectionner'}
          </button>
          {allReels.map(r => {
            const isSelected = selected.has(r.id)
            return (
              <div key={r.id} onClick={() => toggle(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 4,
                background: isSelected ? 'rgba(255,0,0,0.06)' : 'transparent',
                border: `1px solid ${isSelected ? '#FF0000' : '#262626'}`,
                borderRadius: 7, cursor: 'pointer',
              }}>
                <div style={{
                  width: 18, height: 18, flexShrink: 0,
                  border: `2px solid ${isSelected ? '#FF0000' : '#444'}`,
                  background: isSelected ? '#FF0000' : 'transparent',
                  borderRadius: 4, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>{isSelected && '✓'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title || '(sans titre)'}
                  </div>
                  {r.hook && (
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🪝 {r.hook}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #262626', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', background: 'transparent', color: '#888',
            border: '1px solid #262626', borderRadius: 7, fontSize: 12, cursor: 'pointer',
          }}>Annuler</button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            style={{
              padding: '8px 16px',
              background: selected.size === 0 ? '#3a1a1a' : '#FF0000',
              color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 700,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            }}>
            📋 Préparer {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function NavBtn({
  embedded, onSwitchView, target, href, style, children,
}: {
  embedded?: boolean
  onSwitchView?: (view: 'jour-j' | 'brief') => void
  target: 'jour-j' | 'brief'
  href: string
  style: React.CSSProperties
  children: React.ReactNode
}) {
  if (embedded && onSwitchView) {
    return <button onClick={() => onSwitchView(target)} style={{ ...style, border: style.border, cursor: 'pointer' }}>{children}</button>
  }
  return <Link href={href} style={style}>{children}</Link>
}

function PlaceDropdown({ current, locations, onPick, onClose }: {
  current: string | null
  locations: string[]
  onPick: (loc: string | null) => void
  onClose: () => void
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
      <input autoFocus placeholder="Filtrer ou créer…" value={filter}
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
      {current && (
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
