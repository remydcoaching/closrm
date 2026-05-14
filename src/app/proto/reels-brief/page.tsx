'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

const MOCK_REELS = [
  {
    id: 'r0', title: 'Dos large en 3 exos', hook: 'Le truc que personne dit pour avoir un dos en V',
    phrases: [
      { text: "Le truc qui change tout c'est de descendre lentement", location: 'Poulie', shot_note: 'gros plan visage', tournée_at: '2026-05-10T14:32:18Z' },
      { text: "Vraiment lentement, genre 4 secondes", location: 'Poulie', shot_note: null, tournée_at: '2026-05-10T14:33:02Z' },
      { text: "Tu vois la barre, tu la fixes pas", location: 'Banc plat', shot_note: 'plan large', tournée_at: '2026-05-10T14:38:45Z' },
      { text: "Là tu vas sentir le brûler dans le grand dorsal", location: 'Poulie', shot_note: null, tournée_at: '2026-05-10T14:34:15Z' },
      { text: "La position de départ c'est genoux fléchis au sol", location: 'Sol', shot_note: 'POV depuis le bas', tournée_at: '2026-05-10T14:42:30Z' },
      { text: "Et tu vois ton dos s'élargir devant le miroir", location: 'Devant le miroir', shot_note: 'reflet visible', tournée_at: '2026-05-10T14:45:10Z' },
    ],
  },
  {
    id: 'r1', title: 'Pull-over technique', hook: "L'exo que tout le monde fait mal",
    phrases: [
      { text: "L'erreur la plus fréquente c'est de plier les coudes", location: 'Banc plat', shot_note: 'pendant le mouvement', tournée_at: '2026-05-10T14:39:20Z' },
      { text: "La vraie technique : bras quasi tendus", location: 'Poulie', shot_note: 'gros plan bras', tournée_at: '2026-05-10T14:35:00Z' },
      { text: "Et là tu sens ton dos qui s'étire", location: 'Sol', shot_note: null, tournée_at: '2026-05-10T14:43:15Z' },
    ],
  },
  {
    id: 'r2', title: 'Routine cardio matin', hook: '15 min pour réveiller le métabolisme',
    phrases: [
      { text: "Première chose le matin : 1 verre d'eau", location: 'Devant le miroir', shot_note: null, tournée_at: '2026-05-10T14:46:00Z' },
      { text: "Puis 20 burpees au sol", location: 'Sol', shot_note: 'plan large énergique', tournée_at: '2026-05-10T14:44:00Z' },
      { text: "Et on finit par 10 tractions à la poulie", location: 'Poulie', shot_note: null, tournée_at: '2026-05-10T14:36:30Z' },
    ],
  },
]

function placeIcon(loc: string | null): string {
  if (!loc) return '📍'
  const l = loc.toLowerCase()
  if (l.includes('poulie') || l.includes('câble')) return '🏋️'
  if (l.includes('banc')) return '🛏️'
  if (l.includes('sol')) return '🟫'
  if (l.includes('miroir')) return '🪞'
  return '📍'
}

interface FlatShot {
  id: string
  reelId: string
  reelIdx: number
  reelTitle: string
  reelHook: string
  position: number
  totalInReel: number
  text: string
  location: string | null
  shotNote: string | null
  tourneeAt: string
  code: string
}

export default function ProtoBriefPage() {
  const [matched, setMatched] = useState<Record<string, boolean>>({})

  const flat: FlatShot[] = useMemo(() => {
    const arr: FlatShot[] = []
    MOCK_REELS.forEach((reel, ri) => {
      reel.phrases.forEach((p, pi) => {
        arr.push({
          id: `${reel.id}-${pi}`,
          reelId: reel.id,
          reelIdx: ri,
          reelTitle: reel.title,
          reelHook: reel.hook,
          position: pi,
          totalInReel: reel.phrases.length,
          text: p.text,
          location: p.location,
          shotNote: p.shot_note,
          tourneeAt: p.tournée_at,
          code: `R${ri + 1}-P${pi + 1}`,
        })
      })
    })
    return arr
  }, [])

  const chrono = useMemo(() =>
    [...flat].sort((a, b) => new Date(a.tourneeAt).getTime() - new Date(b.tourneeAt).getTime()),
    [flat])

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#e5e5e5' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

        <div className="no-print" style={{
          background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF0000' }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 2 }}>
              Brief monteur — V0 PROTO
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {MOCK_REELS.length} reels · {flat.length} phrases tournées · données mockées
            </div>
          </div>
          <Link href="/proto" style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#888', background: 'transparent', border: '1px solid #262626',
            borderRadius: 8, textDecoration: 'none',
          }}>← Retour</Link>
          <button onClick={() => window.print()} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#888', background: 'transparent', border: '1px solid #262626',
            borderRadius: 8, cursor: 'pointer',
          }}>🖨️ Imprimer</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* COLONNE GAUCHE — Chrono */}
          <div>
            <div style={{
              fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12, fontWeight: 700,
            }}>
              ① Ordre des clips reçus (chronologique)
            </div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Pour chaque clip que tu écoutes, identifie la phrase ci-dessous et renomme le fichier avec son code (ex&nbsp;: <code style={{background: '#262626', padding: '1px 5px', borderRadius: 3, color: '#fff', fontFamily: 'monospace'}}>R1-P1</code>).
            </div>
            {chrono.map(s => (
              <div key={s.id} style={{
                background: matched[s.id] ? '#0a1a0a' : '#141414',
                border: `1px solid ${matched[s.id] ? '#1a3a1a' : '#262626'}`,
                borderRadius: 8, padding: 12, marginBottom: 8,
                opacity: matched[s.id] ? 0.55 : 1,
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'all 0.15s',
              }}>
                <input type="checkbox" checked={!!matched[s.id]}
                  onChange={() => setMatched(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  className="no-print"
                  style={{ width: 16, height: 16, accentColor: '#38A169', marginTop: 4, flexShrink: 0, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 11, flexWrap: 'wrap' }}>
                    <span style={{ color: '#666', fontFamily: 'monospace' }}>{fmtTime(s.tourneeAt)}</span>
                    <span style={{ color: '#fff' }}>{placeIcon(s.location)} {s.location ?? '—'}</span>
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700,
                      color: '#FF0000', background: 'rgba(255,0,0,0.1)',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    }}>{s.code}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
                    « {s.text} »
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                    {s.reelTitle}
                    {s.shotNote && <span style={{ color: '#d69e2e', marginLeft: 10 }}>🎥 {s.shotNote}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* COLONNE DROITE — Par reel */}
          <div>
            <div style={{
              fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12, fontWeight: 700,
            }}>
              ② Ordre de montage par reel
            </div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Une fois tes clips renommés, monte chaque reel en respectant l&apos;ordre ci-dessous.
            </div>
            {MOCK_REELS.map((reel, ri) => {
              const reelShots = flat.filter(s => s.reelId === reel.id).sort((a, b) => a.position - b.position)
              return (
                <div key={reel.id} style={{
                  background: '#141414', border: '1px solid #262626',
                  borderRadius: 10, padding: 14, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    🎬 Reel {ri + 1} — {reel.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 12, fontStyle: 'italic' }}>
                    🪝 {reel.hook}
                  </div>
                  {reelShots.map((s, i) => (
                    <div key={s.id} style={{
                      padding: '10px 0', borderTop: i > 0 ? '1px solid #1a1a1a' : 'none',
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 10, minWidth: 16 }}>{i + 1}.</span>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: '#FF0000', background: 'rgba(255,0,0,0.1)',
                          padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        }}>{s.code}</span>
                        <span style={{ color: '#888', fontSize: 11 }}>{placeIcon(s.location)} {s.location ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.4, paddingLeft: 24 }}>
                        « {s.text} »
                      </div>
                      {s.shotNote && (
                        <div style={{ fontSize: 10, color: '#d69e2e', paddingLeft: 24, marginTop: 4 }}>
                          🎥 {s.shotNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
