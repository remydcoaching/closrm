'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ReelShot {
  id: string
  social_post_id: string
  position: number
  text: string
  location: string | null
  shot_note: string | null
  done: boolean
  skipped: boolean
}

interface SocialPost {
  id: string
  title: string | null
  hook: string | null
}

interface ShotInfo {
  id: string
  reelId: string
  reelTitle: string
  text: string
  shotNote: string | null
  position: number
  total: number
  prevText: string | null
  nextText: string | null
  skipped: boolean
}

function placeIcon(loc: string): string {
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  if (l.includes('plage') || l.includes('extér') || l.includes('dehors')) return '🌳'
  return '📍'
}

export default function JourJPageWrapper() {
  return <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>Chargement…</div>}><JourJView /></Suspense>
}

interface JourJViewProps {
  embedded?: boolean
  reelParamProp?: string | null
  onClose?: () => void
  onSwitchView?: (view: 'prep' | 'brief') => void
}

export function JourJView({ embedded, reelParamProp, onClose, onSwitchView }: JourJViewProps = {}) {
  const searchParams = useSearchParams()
  const reelParam = embedded ? (reelParamProp ?? null) : searchParams.get('reel')

  const [shots, setShots] = useState<ReelShot[]>([])
  const [reels, setReels] = useState<SocialPost[]>([])
  const [placeIdx, setPlaceIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewReelId, setPreviewReelId] = useState<string | null>(null)
  const [previewHighlightShotId, setPreviewHighlightShotId] = useState<string | null>(null)

  const reelIds = useMemo(() => {
    if (!reelParam) return null
    return reelParam.split(',').map(s => s.trim()).filter(Boolean)
  }, [reelParam])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const reelsRes = await fetch('/api/social/posts?content_kind=reel&slim=true&per_page=100')
      if (!reelsRes.ok) throw new Error(`Reels fetch: ${reelsRes.status}`)
      const reelsJson = await reelsRes.json()
      const allReels: SocialPost[] = reelsJson.data ?? []
      const filtered = reelIds ? allReels.filter(r => reelIds.includes(r.id)) : allReels
      setReels(filtered)

      // Sync : si l'user a modifié son script, on re-split en reel_shots avant
      // d'afficher. Sinon on continue d'afficher l'ancien texte.
      await Promise.all(filtered.map(r =>
        fetch('/api/reel-shots/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ social_post_id: r.id }),
        }).catch(() => null)
      ))

      let shotsUrl = '/api/reel-shots'
      if (filtered.length > 0) shotsUrl += `?social_post_ids=${filtered.map(r => r.id).join(',')}`
      const shotsRes = await fetch(shotsUrl)
      if (!shotsRes.ok) throw new Error(`Shots fetch: ${shotsRes.status}`)
      const shotsJson = await shotsRes.json()
      setShots(shotsJson.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [reelIds])

  useEffect(() => { loadAll() }, [loadAll])

  // Wake lock — empêche l'écran de s'éteindre pendant le tournage
  useEffect(() => {
    type WL = { release: () => Promise<void> }
    let lock: WL | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WL> } }
    if (nav.wakeLock?.request) {
      nav.wakeLock.request('screen')
        .then(s => { lock = s })
        .catch(() => {/* ignore — pas critique */})
    }
    return () => { lock?.release().catch(() => {}) }
  }, [])

  function buzz() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(30) } catch {/* iOS Safari peut bloquer */}
    }
  }

  async function patchShot(id: string, patch: Partial<Pick<ReelShot, 'done' | 'skipped'>>) {
    if (patch.done) buzz()
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
    const res = await fetch(`/api/reel-shots/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) loadAll()
  }

  const byPlace = useMemo(() => {
    const r: Record<string, ShotInfo[]> = {}
    const byReel = new Map<string, ReelShot[]>()
    shots.forEach(s => {
      if (!byReel.has(s.social_post_id)) byReel.set(s.social_post_id, [])
      byReel.get(s.social_post_id)!.push(s)
    })
    byReel.forEach(arr => arr.sort((a, b) => a.position - b.position))

    shots.forEach(s => {
      if (!s.text || s.done || !s.location) return
      const arr = byReel.get(s.social_post_id) ?? []
      const idx = arr.findIndex(x => x.id === s.id)
      const reel = reels.find(re => re.id === s.social_post_id)
      const reelTitle = reel?.title || reel?.hook || '(sans titre)'
      if (!r[s.location]) r[s.location] = []
      r[s.location].push({
        id: s.id,
        reelId: s.social_post_id,
        reelTitle,
        text: s.text,
        shotNote: s.shot_note,
        position: idx + 1,
        total: arr.length,
        prevText: idx > 0 ? arr[idx - 1].text : null,
        nextText: idx < arr.length - 1 ? arr[idx + 1].text : null,
        skipped: s.skipped,
      })
    })
    return r
  }, [shots, reels])

  const places = useMemo(() => Object.keys(byPlace).sort((a, b) => {
    const aActive = byPlace[a].filter(s => !s.skipped).length
    const bActive = byPlace[b].filter(s => !s.skipped).length
    return bActive - aActive
  }), [byPlace])

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Chargement…</div>
  if (error) return (
    <div style={{ padding: 40, color: '#E53E3E' }}>
      Erreur : {error}
      <button onClick={loadAll} style={{ marginLeft: 12, padding: '6px 12px', background: '#E53E3E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>↻ Réessayer</button>
    </div>
  )

  if (places.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', minHeight: '100vh', background: '#000' }}>
        <div style={{ fontSize: 48, marginBottom: 12, marginTop: 60 }}>🎉</div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Tous les shots sont tournés !</div>
        <div style={{ fontSize: 12, marginBottom: 24 }}>(ou aucun lieu n&apos;est encore assigné)</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {embedded && onSwitchView ? (
            <>
              <button onClick={() => onSwitchView('brief')} style={{
                display: 'inline-block', padding: '10px 18px',
                background: '#FF0000', color: '#fff', borderRadius: 8,
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>📄 Voir le brief monteur</button>
              <button onClick={() => onSwitchView('prep')} style={{
                display: 'inline-block', padding: '10px 18px',
                background: 'transparent', color: '#888', borderRadius: 8,
                border: '1px solid #262626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>← Retour à la prep</button>
            </>
          ) : (
            <>
              <Link href={reelParam ? `/acquisition/reels/tournage/brief?reel=${reelParam}` : '/acquisition/reels/tournage/brief'} style={{
                display: 'inline-block', padding: '10px 18px',
                background: '#FF0000', color: '#fff', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
              }}>📄 Voir le brief monteur</Link>
              <Link href={reelParam ? `/acquisition/reels/tournage/prep?reel=${reelParam}` : '/acquisition/reels/tournage/prep'} style={{
                display: 'inline-block', padding: '10px 18px',
                background: 'transparent', color: '#888', borderRadius: 8,
                border: '1px solid #262626', textDecoration: 'none', fontSize: 13, fontWeight: 600,
              }}>← Retour à la prep</Link>
            </>
          )}
        </div>
      </div>
    )
  }

  const safeIdx = placeIdx >= places.length ? 0 : placeIdx
  const currentPlace = places[safeIdx]
  const allShots = byPlace[currentPlace]
  const activeShots = allShots.filter(s => !s.skipped)
  const skippedShots = allShots.filter(s => s.skipped)
  const reelGroups: Record<string, { title: string; shots: ShotInfo[] }> = {}
  activeShots.forEach(s => {
    if (!reelGroups[s.reelId]) reelGroups[s.reelId] = { title: s.reelTitle, shots: [] }
    reelGroups[s.reelId].shots.push(s)
  })

  const nextIdx = (safeIdx + 1) % places.length
  const nextLabel = nextIdx === 0 ? 'Boucle 1er' : `${places[nextIdx]} (${byPlace[places[nextIdx]].length})`

  return (
    <div style={{
      padding: '12px max(12px, env(safe-area-inset-left)) 12px max(12px, env(safe-area-inset-right))',
      display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#000', color: '#e5e5e5',
    }}>
      <div style={{
        background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
        borderRadius: 10, padding: '12px 16px', marginBottom: 16, width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {embedded && onSwitchView ? (
          <button onClick={() => onSwitchView('prep')} style={{ color: '#FF0000', background: 'transparent', border: 'none', fontSize: 12, cursor: 'pointer', padding: 0 }}>← Prep</button>
        ) : (
          <Link href={reelParam ? `/acquisition/reels/tournage/prep?reel=${reelParam}` : '/acquisition/reels/tournage/prep'} style={{ color: '#FF0000', textDecoration: 'none', fontSize: 12 }}>← Prep</Link>
        )}
        <div style={{ flex: 1, fontSize: 12, color: '#888', textAlign: 'center' }}>
          🎬 Jour J{reelIds ? ` · ${reelIds.length}` : ''}
        </div>
        {embedded && onClose && (
          <button onClick={onClose} style={{ color: '#666', background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', padding: 0 }}>✕</button>
        )}
      </div>

      <div style={{
        width: '100%', background: '#0a0a0a',
        border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden',
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
                <div key={s.id} style={{
                  background: '#141414', border: '1px solid #262626',
                  borderRadius: 14, padding: 18, marginBottom: 10,
                }}>
                  <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Phrase {s.position}/{s.total}
                  </div>
                  {s.prevText && (
                    <div style={{
                      marginBottom: 8, paddingLeft: 10, borderLeft: '2px solid #262626',
                    }}>
                      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                        ↑ Phrase précédente
                      </div>
                      <div style={{
                        fontSize: 11, color: '#555', fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{s.prevText}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 17, lineHeight: 1.4, color: '#fff', fontWeight: 700, marginBottom: 10 }}>
                    « {s.text} »
                  </div>
                  {s.shotNote && (
                    <div style={{
                      fontSize: 12, color: '#d69e2e', marginBottom: 12,
                      padding: '8px 10px', background: 'rgba(214, 158, 46, 0.08)',
                      border: '1px solid rgba(214, 158, 46, 0.2)', borderRadius: 8,
                    }}>🎥 {s.shotNote}</div>
                  )}
                  {s.nextText && (
                    <div style={{
                      marginBottom: 12, paddingLeft: 10, borderLeft: '2px solid #262626',
                    }}>
                      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                        ↓ Phrase suivante
                      </div>
                      <div style={{
                        fontSize: 11, color: '#555', fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{s.nextText}</div>
                    </div>
                  )}
                  <button
                    onClick={() => { setPreviewReelId(s.reelId); setPreviewHighlightShotId(s.id) }}
                    style={{
                      marginBottom: 12, padding: '6px 11px', fontSize: 11, fontWeight: 600,
                      color: '#888', background: 'transparent',
                      border: '1px solid #262626', borderRadius: 6, cursor: 'pointer',
                    }}>👁 Voir le reel entier</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => patchShot(s.id, { done: true, skipped: false })} style={{
                      flex: 1, padding: 11, fontSize: 13, fontWeight: 700,
                      border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: '#38A169', color: '#fff',
                    }}>✓ Tournée</button>
                    <button onClick={() => patchShot(s.id, { skipped: true })} style={{
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

          {skippedShots.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #262626' }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                ⏭️ À reporter ({skippedShots.length})
              </div>
              {skippedShots.map(s => (
                <div key={s.id} style={{
                  background: '#0f0f0f', border: '1px solid #1f1f1f',
                  borderRadius: 10, padding: 12, marginBottom: 8, opacity: 0.6,
                }}>
                  <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>
                    Reel · {s.reelTitle} · Phrase {s.position}/{s.total}
                  </div>
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8, lineHeight: 1.3 }}>« {s.text} »</div>
                  <button onClick={() => patchShot(s.id, { skipped: false })} style={{
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
          <button onClick={() => setPlaceIdx((safeIdx - 1 + places.length) % places.length)} style={{
            background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12,
          }}>← Précédent</button>
          <button onClick={() => setPlaceIdx(nextIdx)} style={{
            background: 'transparent', border: 'none', color: '#FF0000', fontWeight: 700, cursor: 'pointer', fontSize: 12,
          }}>{nextLabel} →</button>
        </div>
      </div>

      {previewReelId && (
        <ReelPreviewModal
          reelId={previewReelId}
          reelTitle={(() => { const r = reels.find(x => x.id === previewReelId); return r?.title || r?.hook || '(sans titre)' })()}
          shots={shots.filter(x => x.social_post_id === previewReelId).slice().sort((a, b) => a.position - b.position)}
          highlightShotId={previewHighlightShotId}
          onClose={() => { setPreviewReelId(null); setPreviewHighlightShotId(null) }}
        />
      )}
    </div>
  )
}

function ReelPreviewModal({ reelId: _reelId, reelTitle, shots, highlightShotId, onClose }: {
  reelId: string
  reelTitle: string
  shots: ReelShot[]
  highlightShotId: string | null
  onClose: () => void
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0a0a0a', border: '1px solid #262626', borderRadius: 14,
        width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #262626',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reel entier</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>{reelTitle}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{shots.length} phrase{shots.length > 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{
            color: '#888', background: 'transparent', border: 'none',
            fontSize: 18, cursor: 'pointer', padding: '4px 8px',
          }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {shots.length === 0 ? (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 20 }}>Aucune phrase</div>
          ) : (
            shots.map(s => {
              const isCurrent = s.id === highlightShotId
              return (
                <div key={s.id} style={{
                  background: isCurrent ? 'rgba(255,0,0,0.08)' : '#141414',
                  border: `1px solid ${isCurrent ? '#FF0000' : '#262626'}`,
                  borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: isCurrent ? '#FF0000' : '#666', fontWeight: 700 }}>
                      {s.position + 1}/{shots.length}
                    </span>
                    {s.done && <span style={{ fontSize: 10, color: '#38A169', fontWeight: 700 }}>✓ tournée</span>}
                    {s.skipped && !s.done && <span style={{ fontSize: 10, color: '#d69e2e', fontWeight: 700 }}>⏭ reportée</span>}
                    {s.location && <span style={{ fontSize: 10, color: '#888' }}>📍 {s.location}</span>}
                    {isCurrent && <span style={{ fontSize: 10, color: '#FF0000', fontWeight: 700 }}>← ici</span>}
                  </div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.4,
                    color: s.done ? '#666' : '#fff',
                    textDecoration: s.done ? 'line-through' : 'none',
                    fontWeight: isCurrent ? 700 : 400,
                  }}>{s.text}</div>
                  {s.shot_note && (
                    <div style={{
                      marginTop: 6, fontSize: 11, color: '#d69e2e',
                      padding: '6px 8px', background: 'rgba(214, 158, 46, 0.08)',
                      border: '1px solid rgba(214, 158, 46, 0.2)', borderRadius: 6,
                    }}>🎥 {s.shot_note}</div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
