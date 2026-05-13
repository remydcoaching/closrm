'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
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
  updated_at: string
  done_at: string | null
}

interface SocialPost {
  id: string
  title: string | null
  hook: string | null
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

export default function BriefMontagePageWrapper() {
  return <Suspense fallback={<div style={{ padding: 40, color: '#888' }}>Chargement…</div>}><BriefView /></Suspense>
}

interface BriefViewProps {
  embedded?: boolean
  reelParamProp?: string | null
  onClose?: () => void
  onSwitchView?: (view: 'prep' | 'jour-j') => void
}

export function BriefView({ embedded, reelParamProp, onClose, onSwitchView }: BriefViewProps = {}) {
  const searchParams = useSearchParams()
  const reelParam = embedded ? (reelParamProp ?? null) : searchParams.get('reel')

  const [reels, setReels] = useState<SocialPost[]>([])
  const [shots, setShots] = useState<ReelShot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const reelsRes = await fetch('/api/social/posts?content_kind=reel&slim=true&per_page=100')
        if (!reelsRes.ok) throw new Error(`Reels: ${reelsRes.status}`)
        const reelsJson = await reelsRes.json()
        const allReels: SocialPost[] = reelsJson.data ?? []
        const reelIds = reelParam ? reelParam.split(',').map(s => s.trim()) : null
        const filtered = reelIds ? allReels.filter(r => reelIds.includes(r.id)) : allReels
        // Tri stable par id pour codes R1, R2... reproductibles
        filtered.sort((a, b) => a.id.localeCompare(b.id))
        setReels(filtered)

        let url = '/api/reel-shots'
        if (filtered.length > 0) url += `?social_post_ids=${filtered.map(r => r.id).join(',')}`
        const shotsRes = await fetch(url)
        if (!shotsRes.ok) throw new Error(`Shots: ${shotsRes.status}`)
        const shotsJson = await shotsRes.json()
        // On garde TOUS les shots done OR skipped (le brief montre les 2 sections)
        setShots((shotsJson.data ?? []).filter((s: ReelShot) => s.done || s.skipped))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur')
      } finally {
        setLoading(false)
      }
    })()
  }, [reelParam])

  // Génère un code court par phrase : R1-P1, R1-P2, R2-P1, etc.
  // Stable car reels triés par id et position est invariant.
  const codeMap = useMemo(() => {
    const m: Record<string, string> = {}
    reels.forEach((reel, ri) => {
      const reelShots = shots.filter(s => s.social_post_id === reel.id).sort((a, b) => a.position - b.position)
      reelShots.forEach((s) => {
        m[s.id] = `R${ri + 1}-P${s.position + 1}`
      })
    })
    return m
  }, [reels, shots])

  // Timeline chronologique : utilise done_at en priorité, fallback updated_at
  const chrono = useMemo(() => {
    const doneShots = shots.filter(s => s.done)
    return [...doneShots].sort((a, b) => {
      const ta = new Date(a.done_at ?? a.updated_at).getTime()
      const tb = new Date(b.done_at ?? b.updated_at).getTime()
      return ta - tb
    })
  }, [shots])

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Chargement…</div>
  if (error) return <div style={{ padding: 40, color: '#E53E3E' }}>Erreur : {error}</div>
  if (shots.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>Aucune phrase tournée</div>
        <div style={{ fontSize: 12, marginBottom: 20 }}>
          Le brief monteur s&apos;active quand au moins 1 phrase est marquée &quot;✓ Tournée&quot;.
        </div>
        {embedded && onSwitchView ? (
          <button onClick={() => onSwitchView('jour-j')} style={{ padding: '8px 14px', background: '#FF0000', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer' }}>← Retour au jour J</button>
        ) : (
          <Link href={reelParam ? `/acquisition/reels/tournage/jour-j?reel=${reelParam}` : '/acquisition/reels/tournage/jour-j'}
            style={{ padding: '8px 14px', background: '#FF0000', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 12 }}>
            ← Retour au jour J
          </Link>
        )}
      </div>
    )
  }

  const skippedShots = shots.filter(s => s.skipped)

  function fmtTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function reelTitle(r: SocialPost): string {
    return r.title?.trim() || 'Sans titre'
  }

  function copyLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => alert('Lien copié — colle-le au monteur'))
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', color: '#e5e5e5' }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .brief-container { color: black !important; }
        }
      `}</style>

      <div className="no-print" style={{
        background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
        borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        display: 'flex', gap: 14, alignItems: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#FF0000' }}>📄</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 2 }}>
            Brief monteur
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {reels.length} reel{reels.length > 1 ? 's' : ''} · {chrono.length} phrase{chrono.length > 1 ? 's' : ''} tournée{chrono.length > 1 ? 's' : ''}
            {skippedShots.length > 0 && (
              <span style={{ color: '#d69e2e' }}> · {skippedShots.length} reportée{skippedShots.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        {embedded && onSwitchView && (
          <button onClick={() => onSwitchView('jour-j')} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#888', background: 'transparent', border: '1px solid #262626', borderRadius: 8, cursor: 'pointer',
          }}>← Jour J</button>
        )}
        <button onClick={copyLink} style={{
          padding: '8px 14px', fontSize: 12, fontWeight: 600,
          color: '#fff', background: '#FF0000', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>📋 Copier le lien</button>
        <button onClick={() => window.print()} style={{
          padding: '8px 14px', fontSize: 12, fontWeight: 600,
          color: '#888', background: 'transparent', border: '1px solid #262626', borderRadius: 8, cursor: 'pointer',
        }}>🖨️ Imprimer</button>
        {embedded && onClose && (
          <button onClick={onClose} style={{
            padding: '8px 12px', fontSize: 12, fontWeight: 600,
            color: '#666', background: 'transparent', border: '1px solid #262626', borderRadius: 8, cursor: 'pointer',
          }}>✕</button>
        )}
      </div>

      <div className="brief-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* COLONNE GAUCHE — Ordre chronologique des clips */}
        <div>
          <div style={{
            fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12, fontWeight: 700,
          }}>
            ① Ordre des clips reçus (chronologique)
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
            Pour chaque clip que tu écoutes, identifie la phrase ci-dessous et note le code (ex&nbsp;: <code style={{background: '#262626', padding: '1px 5px', borderRadius: 3, color: '#fff'}}>R1-P1</code>) sur le fichier.
          </div>
          {chrono.map(s => {
            const code = codeMap[s.id]
            const reel = reels.find(r => r.id === s.social_post_id)
            return (
              <div key={s.id} style={{
                background: matched[s.id] ? '#0a1a0a' : '#141414',
                border: `1px solid ${matched[s.id] ? '#1a3a1a' : '#262626'}`,
                borderRadius: 8, padding: 12, marginBottom: 8,
                opacity: matched[s.id] ? 0.6 : 1,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <input type="checkbox" checked={!!matched[s.id]}
                  onChange={() => setMatched(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  className="no-print"
                  style={{ width: 16, height: 16, accentColor: '#38A169', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: '#666', fontFamily: 'monospace' }}>{fmtTime(s.done_at ?? s.updated_at)}</span>
                    <span style={{ color: '#fff' }}>{placeIcon(s.location)} {s.location ?? '—'}</span>
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700,
                      color: '#FF0000', background: 'rgba(255,0,0,0.1)',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    }}>{code}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
                    « {s.text} »
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                    Reel : {reel ? reelTitle(reel) : 'Sans titre'}
                  </div>
                  {s.shot_note && (
                    <div style={{ fontSize: 10, color: '#d69e2e', marginTop: 3 }}>
                      🎥 {s.shot_note}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* COLONNE DROITE — Ordre par reel (montage) */}
        <div>
          <div style={{
            fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 12, fontWeight: 700,
          }}>
            ② Ordre de montage par reel
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
            Une fois tes clips renommés avec leurs codes, monte chaque reel en suivant l&apos;ordre ci-dessous.
          </div>
          {reels.map((reel, ri) => {
            const reelShots = shots.filter(s => s.social_post_id === reel.id && s.done).sort((a, b) => a.position - b.position)
            if (reelShots.length === 0) return null
            return (
              <div key={reel.id} style={{
                background: '#141414', border: '1px solid #262626',
                borderRadius: 10, padding: 14, marginBottom: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  🎬 Reel {ri + 1} — {reelTitle(reel)}
                </div>
                {reel.hook && (
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 12, fontStyle: 'italic' }}>
                    🪝 {reel.hook}
                  </div>
                )}
                {reelShots.map((s, i) => {
                  const code = codeMap[s.id]
                  return (
                    <div key={s.id} style={{
                      padding: '8px 0', borderTop: i > 0 ? '1px solid #1a1a1a' : 'none',
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
                        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 10 }}>{i + 1}.</span>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: '#FF0000', background: 'rgba(255,0,0,0.1)',
                          padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        }}>{code}</span>
                        <span style={{ color: '#888', fontSize: 11 }}>{placeIcon(s.location)} {s.location ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.4, paddingLeft: 24 }}>
                        « {s.text} »
                      </div>
                      {s.shot_note && (
                        <div style={{ fontSize: 10, color: '#d69e2e', paddingLeft: 24, marginTop: 4 }}>
                          🎥 {s.shot_note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {skippedShots.length > 0 && (
        <div style={{
          marginTop: 24, background: '#141414',
          border: '1px solid #262626', borderLeft: '3px solid #d69e2e',
          borderRadius: 10, padding: 16,
        }}>
          <div style={{
            fontSize: 11, color: '#d69e2e', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700,
          }}>
            ⏭️ Phrases reportées ({skippedShots.length})
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>
            Ces phrases ne sont pas tournées. Le coach les filmera plus tard. Elles ne sont PAS dans le ZIP des rushes — ne les attends pas.
          </div>
          {skippedShots.map(s => {
            const reel = reels.find(r => r.id === s.social_post_id)
            const code = codeMap[s.id]
            return (
              <div key={s.id} style={{
                padding: '8px 12px', marginBottom: 6,
                background: '#0f0f0f', border: '1px solid #1f1f1f',
                borderRadius: 8, fontSize: 12, color: '#aaa',
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontFamily: 'monospace', fontWeight: 700,
                    color: '#d69e2e', fontSize: 10,
                  }}>{code}</span>
                  <span style={{ color: '#666', fontSize: 10 }}>{reel ? reelTitle(reel) : 'Sans titre'}</span>
                  <span style={{ color: '#666', fontSize: 10, marginLeft: 'auto' }}>
                    {placeIcon(s.location)} {s.location ?? '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.3 }}>« {s.text} »</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
