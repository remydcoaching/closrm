'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface Phrase {
  id: string
  text: string
  location: string | null
  aiSuggested: string | null
  done: boolean
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
  filter: string
  search: string
  collapsedReels: Record<string, boolean>
  aiApplied: boolean
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
  const [state, setState] = useState<PrepState | null>(null)
  const [placeIdx, setPlaceIdx] = useState(0)

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) {
      try { setState(JSON.parse(raw)) } catch {}
    }
    const idx = typeof window !== 'undefined' ? localStorage.getItem(FILM_KEY) : null
    if (idx) setPlaceIdx(parseInt(idx, 10) || 0)
  }, [])

  useEffect(() => {
    if (state && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FILM_KEY, String(placeIdx))
    }
  }, [placeIdx])

  const byPlace = useMemo(() => {
    if (!state) return {} as Record<string, { reelId: string; reelTitle: string; phraseId: string; text: string }[]>
    const r: Record<string, { reelId: string; reelTitle: string; phraseId: string; text: string }[]> = {}
    state.reels.forEach(reel => {
      reel.phrases.forEach(p => {
        if (!p.text || p.done || !p.location) return
        if (!r[p.location]) r[p.location] = []
        r[p.location].push({ reelId: reel.id, reelTitle: reel.title, phraseId: p.id, text: p.text })
      })
    })
    return r
  }, [state])

  const places = useMemo(() => {
    return Object.keys(byPlace).sort((a, b) => byPlace[b].length - byPlace[a].length)
  }, [byPlace])

  if (!state) {
    return <div style={{ padding: 40, color: '#888' }}>Chargement…</div>
  }

  if (places.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Tous les shots sont tournés !</div>
        <div style={{ fontSize: 12, marginBottom: 24 }}>
          (ou aucun lieu n&apos;est encore assigné)
        </div>
        <Link href="/acquisition/reels/tournage/prep" style={{
          display: 'inline-block', padding: '10px 18px',
          background: '#FF0000', color: '#fff', borderRadius: 8,
          textDecoration: 'none', fontSize: 13, fontWeight: 600,
        }}>
          ← Retour à la prep
        </Link>
      </div>
    )
  }

  const safeIdx = placeIdx >= places.length ? 0 : placeIdx
  const currentPlace = places[safeIdx]
  const shots = byPlace[currentPlace]
  const reelGroups: Record<string, { title: string; shots: typeof shots }> = {}
  shots.forEach(s => {
    if (!reelGroups[s.reelId]) reelGroups[s.reelId] = { title: s.reelTitle, shots: [] }
    reelGroups[s.reelId].shots.push(s)
  })

  function markDone(reelId: string, phraseId: string) {
    setState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        reels: prev.reels.map(r => r.id === reelId ? {
          ...r,
          phrases: r.phrases.map(p => p.id === phraseId ? { ...p, done: true } : p),
        } : r),
      }
    })
  }

  const nextIdx = (safeIdx + 1) % places.length
  const nextLabel = nextIdx === 0 ? 'Boucle 1er' : `${places[nextIdx]} (${byPlace[places[nextIdx]].length})`

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: '#000' }}>
      <div style={{
        background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20, width: '100%', maxWidth: 360,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Link href="/acquisition/reels/tournage/prep" style={{ color: '#FF0000', textDecoration: 'none', fontSize: 12 }}>
          ← Prep
        </Link>
        <div style={{ flex: 1, fontSize: 12, color: '#888', textAlign: 'right' }}>
          🎬 Jour J
        </div>
      </div>

      <div style={{
        width: 360, background: '#0a0a0a',
        border: '1px solid #1a1a1a', borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', background: '#141414', borderBottom: '1px solid #262626' }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Lieu actuel · {safeIdx + 1}/{places.length}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
            {placeIcon(currentPlace)} {currentPlace}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {shots.length} shot{shots.length > 1 ? 's' : ''} · {Object.keys(reelGroups).length} reel{Object.keys(reelGroups).length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 18, minHeight: 380 }}>
          {Object.entries(reelGroups).map(([rid, g]) => (
            <div key={rid}>
              <div style={{
                fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8, marginTop: 18,
              }}>
                Reel · {g.title}
              </div>
              {g.shots.map(s => (
                <div key={s.phraseId} style={{
                  background: '#141414', border: '1px solid #262626',
                  borderRadius: 14, padding: 18, marginBottom: 10,
                }}>
                  <div style={{ fontSize: 16, lineHeight: 1.4, color: '#fff', fontWeight: 600, marginBottom: 14 }}>
                    « {s.text} »
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => markDone(s.reelId, s.phraseId)} style={{
                      flex: 1, padding: 11, fontSize: 13, fontWeight: 700,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: '#38A169', color: '#fff',
                    }}>✓ Tournée</button>
                    <button style={{
                      padding: '11px 18px', background: 'transparent', color: '#888',
                      border: '1px solid #262626', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    }}>Skip</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
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
