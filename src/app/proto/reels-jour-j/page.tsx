'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Phrase { id: string; text: string; location: string | null; aiSuggested: string | null; done: boolean; skipped?: boolean; shotNote?: string }
interface Reel { id: string; title: string; hook: string; phrases: Phrase[] }
interface PrepState { reels: Reel[]; locations: string[]; filter: string; search: string; collapsedReels: Record<string, boolean>; aiApplied: boolean }

interface ShotInfo {
  reelId: string
  reelTitle: string
  phraseId: string
  text: string
  shotNote?: string
  position: number
  total: number
  prevText: string | null
  nextText: string | null
  skipped: boolean
}

const STORAGE_KEY = 'closrm-reels-prep-v0'
const FILM_KEY = 'closrm-reels-jour-j-v0'

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

export default function JourJPage() {
  const searchParams = useSearchParams()
  const reelParam = searchParams.get('reel')
  const reelFilter = useMemo(() => {
    if (!reelParam) return null
    return reelParam.split(',').map(s => s.trim()).filter(Boolean)
  }, [reelParam])

  const [state, setState] = useState<PrepState | null>(null)
  const [placeIdx, setPlaceIdx] = useState(0)

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) { try { setState(JSON.parse(raw)) } catch {} }
    const idx = typeof window !== 'undefined' ? localStorage.getItem(FILM_KEY) : null
    if (idx) setPlaceIdx(parseInt(idx, 10) || 0)
  }, [])

  useEffect(() => {
    if (state && typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(FILM_KEY, String(placeIdx))
  }, [placeIdx])

  const byPlace = useMemo(() => {
    if (!state) return {} as Record<string, ShotInfo[]>
    const r: Record<string, ShotInfo[]> = {}
    const filteredReels = reelFilter ? state.reels.filter(reel => reelFilter.includes(reel.id)) : state.reels
    filteredReels.forEach(reel => {
      const total = reel.phrases.length
      reel.phrases.forEach((p, idx) => {
        if (!p.text || p.done || !p.location) return
        if (!r[p.location]) r[p.location] = []
        r[p.location].push({
          reelId: reel.id,
          reelTitle: reel.title,
          phraseId: p.id,
          text: p.text,
          shotNote: p.shotNote,
          position: idx + 1,
          total,
          prevText: idx > 0 ? reel.phrases[idx - 1].text : null,
          nextText: idx < total - 1 ? reel.phrases[idx + 1].text : null,
          skipped: !!p.skipped,
        })
      })
    })
    return r
  }, [state, reelFilter])

  // Trier les places par count des shots NON-skipped (priorité)
  const places = useMemo(() => Object.keys(byPlace).sort((a, b) => {
    const aActive = byPlace[a].filter(s => !s.skipped).length
    const bActive = byPlace[b].filter(s => !s.skipped).length
    return bActive - aActive
  }), [byPlace])

  if (!state) return <div style={{ padding: 40, color: '#888', background: '#000', minHeight: '100vh' }}>Chargement…</div>

  if (places.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#000', minHeight: '100vh' }}>
        <div style={{ fontSize: 48, marginBottom: 12, marginTop: 60 }}>🎉</div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Tous les shots sont tournés !</div>
        <div style={{ fontSize: 12, marginBottom: 24 }}>(ou aucun lieu n&apos;est encore assigné)</div>
        <Link href="/proto/reels-prep" style={{
          display: 'inline-block', padding: '10px 18px',
          background: '#FF0000', color: '#fff', borderRadius: 8,
          textDecoration: 'none', fontSize: 13, fontWeight: 600,
        }}>← Retour à la prep</Link>
      </div>
    )
  }

  const safeIdx = placeIdx >= places.length ? 0 : placeIdx
  const currentPlace = places[safeIdx]
  const allShots = byPlace[currentPlace]
  // Sépare actifs vs skippés — les skippés vont en bas, dans une section dédiée
  const activeShots = allShots.filter(s => !s.skipped)
  const skippedShots = allShots.filter(s => s.skipped)
  const reelGroups: Record<string, { title: string; shots: ShotInfo[] }> = {}
  activeShots.forEach(s => {
    if (!reelGroups[s.reelId]) reelGroups[s.reelId] = { title: s.reelTitle, shots: [] }
    reelGroups[s.reelId].shots.push(s)
  })

  function markDone(reelId: string, phraseId: string) {
    setState(prev => prev ? {
      ...prev,
      reels: prev.reels.map(r => r.id === reelId ? {
        ...r,
        phrases: r.phrases.map(p => p.id === phraseId ? { ...p, done: true, skipped: false } : p),
      } : r),
    } : prev)
  }

  function skipShot(reelId: string, phraseId: string) {
    setState(prev => prev ? {
      ...prev,
      reels: prev.reels.map(r => r.id === reelId ? {
        ...r,
        phrases: r.phrases.map(p => p.id === phraseId ? { ...p, skipped: true } : p),
      } : r),
    } : prev)
  }

  function unskipShot(reelId: string, phraseId: string) {
    setState(prev => prev ? {
      ...prev,
      reels: prev.reels.map(r => r.id === reelId ? {
        ...r,
        phrases: r.phrases.map(p => p.id === phraseId ? { ...p, skipped: false } : p),
      } : r),
    } : prev)
  }

  function undoDone(reelId: string, phraseId: string) {
    setState(prev => prev ? {
      ...prev,
      reels: prev.reels.map(r => r.id === reelId ? {
        ...r,
        phrases: r.phrases.map(p => p.id === phraseId ? { ...p, done: false } : p),
      } : r),
    } : prev)
  }

  const nextIdx = (safeIdx + 1) % places.length
  const nextLabel = nextIdx === 0 ? 'Boucle 1er' : `${places[nextIdx]} (${byPlace[places[nextIdx]].length})`

  return (
    <div style={{ padding: '12px max(12px, env(safe-area-inset-left)) 12px max(12px, env(safe-area-inset-right))', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000', color: '#e5e5e5' }}>
      <div style={{
        background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20, width: '100%', maxWidth: 360,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Link href={reelParam ? `/proto/reels-prep?reel=${reelParam}` : '/proto/reels-prep'} style={{ color: '#FF0000', textDecoration: 'none', fontSize: 12 }}>← Prep</Link>
        <div style={{ flex: 1, fontSize: 12, color: '#888', textAlign: 'right' }}>
          🎬 Jour J{reelFilter ? ` · ${reelFilter.length} reel${reelFilter.length > 1 ? 's' : ''}` : ''}
        </div>
        {reelFilter && (
          <Link href="/proto/reels-jour-j" style={{ color: '#FF0000', textDecoration: 'none', fontSize: 11, opacity: 0.7 }}>
            (tout)
          </Link>
        )}
      </div>

      <div style={{
        width: '100%', maxWidth: 360, background: '#0a0a0a',
        border: '1px solid #1a1a1a', borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 20px', background: '#141414', borderBottom: '1px solid #262626' }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Lieu actuel · {safeIdx + 1}/{places.length}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
            {placeIcon(currentPlace)} {currentPlace}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {activeShots.length} shot{activeShots.length > 1 ? 's' : ''} · {Object.keys(reelGroups).length} reel{Object.keys(reelGroups).length > 1 ? 's' : ''}
            {skippedShots.length > 0 && ` · ${skippedShots.length} reporté${skippedShots.length > 1 ? 's' : ''}`}
          </div>
        </div>

        <div style={{ padding: 18, minHeight: 380 }}>
          {Object.entries(reelGroups).map(([rid, g]) => (
            <div key={rid}>
              <div style={{
                fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8, marginTop: 18,
              }}>Reel · {g.title}</div>
              {g.shots.map(s => (
                <div key={s.phraseId} style={{
                  background: '#141414', border: '1px solid #262626',
                  borderRadius: 14, padding: 18, marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em',
                    marginBottom: 10, display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>Phrase {s.position}/{s.total}</span>
                  </div>

                  {/* Contexte avant */}
                  {s.prevText && (
                    <div style={{
                      fontSize: 11, color: '#555', marginBottom: 8, fontStyle: 'italic',
                      paddingLeft: 10, borderLeft: '2px solid #262626',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      ↑ {s.prevText}
                    </div>
                  )}

                  {/* Phrase principale */}
                  <div style={{ fontSize: 17, lineHeight: 1.4, color: '#fff', fontWeight: 700, marginBottom: 10 }}>
                    « {s.text} »
                  </div>

                  {/* Cadrage / action */}
                  {s.shotNote && (
                    <div style={{
                      fontSize: 12, color: '#d69e2e', marginBottom: 12,
                      padding: '8px 10px', background: 'rgba(214, 158, 46, 0.08)',
                      border: '1px solid rgba(214, 158, 46, 0.2)', borderRadius: 8,
                    }}>
                      🎥 {s.shotNote}
                    </div>
                  )}

                  {/* Contexte après */}
                  {s.nextText && (
                    <div style={{
                      fontSize: 11, color: '#555', marginBottom: 12, fontStyle: 'italic',
                      paddingLeft: 10, borderLeft: '2px solid #262626',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      ↓ {s.nextText}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => markDone(s.reelId, s.phraseId)} style={{
                      flex: 1, padding: 11, fontSize: 13, fontWeight: 700,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: '#38A169', color: '#fff',
                    }}>✓ Tournée</button>
                    <button onClick={() => skipShot(s.reelId, s.phraseId)} style={{
                      padding: '11px 18px', background: 'transparent', color: '#888',
                      border: '1px solid #262626', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    }}>Reporter</button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {activeShots.length === 0 && skippedShots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              Tout est tourné à ce lieu !
            </div>
          )}

          {/* Section "à reporter" */}
          {skippedShots.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #262626' }}>
              <div style={{
                fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 10,
              }}>
                ⏭️ À reporter ({skippedShots.length})
              </div>
              {skippedShots.map(s => (
                <div key={s.phraseId} style={{
                  background: '#0f0f0f', border: '1px solid #1f1f1f',
                  borderRadius: 10, padding: 12, marginBottom: 8, opacity: 0.6,
                }}>
                  <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>
                    Reel · {s.reelTitle} · Phrase {s.position}/{s.total}
                  </div>
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8, lineHeight: 1.3 }}>
                    « {s.text} »
                  </div>
                  <button onClick={() => unskipShot(s.reelId, s.phraseId)} style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 600,
                    background: 'transparent', color: '#FF0000',
                    border: '1px solid rgba(255,0,0,0.3)', borderRadius: 6, cursor: 'pointer',
                  }}>↻ Remettre</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 18px', background: '#141414', borderTop: '1px solid #262626',
          display: 'flex', justifyContent: 'space-between', fontSize: 12,
        }}>
          <button
            onClick={() => setPlaceIdx((safeIdx - 1 + places.length) % places.length)}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>
            ← Précédent
          </button>
          <button
            onClick={() => setPlaceIdx(nextIdx)}
            style={{ background: 'transparent', border: 'none', color: '#FF0000', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            {nextLabel} →
          </button>
        </div>
      </div>
    </div>
  )
}
