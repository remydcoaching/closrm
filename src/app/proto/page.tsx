'use client'

import { useState } from 'react'
import Link from 'next/link'

const MOCK_REELS = [
  {
    id: 'r0',
    title: 'Dos large en 3 exos',
    hook: 'Le truc que personne dit pour avoir un dos en V',
    script: `Le truc qui change tout c'est de descendre lentement à la poulie
Vraiment lentement, genre 4 secondes
Sur le banc tu vois la barre, tu la fixes pas
Là tu vas sentir le brûler dans le grand dorsal en tirant
La position de départ c'est genoux fléchis au sol
Et tu vois ton dos s'élargir devant le miroir`,
    status: 'À filmer',
  },
  {
    id: 'r1',
    title: 'Pull-over technique',
    hook: "L'exo que tout le monde fait mal",
    script: `L'erreur la plus fréquente c'est de plier les coudes sur le banc
La vraie technique : bras quasi tendus à la poulie
Et là tu sens ton dos qui s'étire au sol`,
    status: 'À filmer',
  },
  {
    id: 'r2',
    title: 'Routine cardio matin',
    hook: '15 min pour réveiller le métabolisme',
    script: `Première chose le matin : 1 verre d'eau devant le miroir
Puis 20 burpees au sol
Et on finit par 10 tractions à la poulie`,
    status: 'À filmer',
  },
]

export default function ProtoIndex() {
  const [selected, setSelected] = useState<string[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id])
  }

  const allIds = MOCK_REELS.map(r => r.id)
  const allSelected = selected.length === MOCK_REELS.length
  const someSelected = selected.length > 0 && !allSelected

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#e5e5e5' }}>
      <div style={{ padding: '24px 32px', maxWidth: 920, margin: '0 auto', paddingBottom: 100 }}>
        <div style={{
          background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #FF0000',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            🧪 Proto V0 — Mock fiche reel ClosRM
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            Voilà à quoi ressembleront tes fiches reels une fois la feature livrée. Le bouton rouge
            <b style={{ color: '#fff' }}> "📋 Préparer mon tournage" </b>
            est l&apos;UNIQUE ajout. Si tu cliques jamais dessus, rien ne change pour toi.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              Mes reels
            </h1>
            <p style={{ fontSize: 13, color: '#666' }}>
              {MOCK_REELS.length} reels en attente de tournage.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setSelected(allSelected ? [] : allIds)}
              style={{
                padding: '6px 12px', background: 'transparent',
                border: '1px solid #262626', borderRadius: 7,
                color: '#888', fontSize: 11, cursor: 'pointer',
              }}>
              {allSelected ? '☑️ Tout désélectionner' : someSelected ? `☐ Tout sélectionner (${selected.length}/${MOCK_REELS.length})` : '☐ Tout sélectionner'}
            </button>
            <Link
              href={`/proto/reels-prep?reel=${allIds.join(',')}`}
              style={{
                padding: '8px 14px',
                background: 'rgba(255,0,0,0.1)', color: '#FF0000',
                border: '1px solid rgba(255,0,0,0.3)', borderRadius: 7,
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}>
              📋 Préparer tous
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_REELS.map(reel => {
            const isSelected = selected.includes(reel.id)
            const isHovered = hoveredId === reel.id
            return (
              <div
                key={reel.id}
                onMouseEnter={() => setHoveredId(reel.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: '#141414',
                  border: `1px solid ${isSelected ? '#FF0000' : '#262626'}`,
                  borderRadius: 12, padding: 20,
                  display: 'flex', gap: 18, alignItems: 'flex-start',
                  transition: 'border-color 0.15s',
                  position: 'relative',
                }}>
                {/* Checkbox */}
                <button
                  onClick={() => toggle(reel.id)}
                  aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                  style={{
                    width: 22, height: 22, marginTop: 2, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#FF0000' : '#444'}`,
                    background: isSelected ? '#FF0000' : 'transparent',
                    borderRadius: 5, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                  }}>
                  {isSelected && '✓'}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'inline-block', padding: '3px 9px', background: '#1a0a0a', color: '#FF0000',
                    border: '1px solid rgba(255,0,0,0.25)', borderRadius: 4,
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700,
                    marginBottom: 10,
                  }}>
                    Reel · {reel.status}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    {reel.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                    🪝 {reel.hook}
                  </div>
                  <div style={{
                    background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8,
                    padding: 12, fontSize: 12, color: '#aaa', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    maxHeight: 100, overflow: 'hidden', position: 'relative',
                  }}>
                    {reel.script}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
                      background: 'linear-gradient(180deg, transparent 0%, #0a0a0a 100%)',
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  <button style={btnSecondary} disabled title="Bouton existant ClosRM (mock)">
                    ✏️ Éditer
                  </button>
                  <button style={btnSecondary} disabled title="Bouton existant ClosRM (mock)">
                    📅 Programmer
                  </button>
                  <Link
                    href={`/proto/reels-prep?reel=${reel.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 14px', background: '#FF0000', color: '#fff',
                      borderRadius: 8, fontSize: 12, fontWeight: 700,
                      textDecoration: 'none', whiteSpace: 'nowrap',
                      boxShadow: isHovered ? '0 4px 16px rgba(255,0,0,0.4)' : '0 4px 16px rgba(255,0,0,0.25)',
                    }}>
                    📋 Préparer mon tournage
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: '#141414', border: '1px dashed #262626', borderRadius: 10,
          fontSize: 12, color: '#888', lineHeight: 1.6,
        }}>
          💡 <b style={{ color: '#fff' }}>Plusieurs façons de préparer</b> :
          <br />• Bouton rouge sur 1 reel = prep ce reel uniquement
          <br />• <b>Coche plusieurs reels</b> via les cases à gauche → bouton flottant en bas qui apparaît
          <br />• Bouton "📋 Préparer tous" en haut à droite = tout d&apos;un coup
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#555' }}>
          Liens proto : {' '}
          <Link href="/proto/reels-prep" style={{ color: '#888' }}>/proto/reels-prep</Link>
          {' · '}
          <Link href="/proto/reels-jour-j" style={{ color: '#888' }}>/proto/reels-jour-j</Link>
        </div>
      </div>

      {/* Floating bulk bar */}
      {selected.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#141414', border: '1px solid #FF0000', borderRadius: 12,
          padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
          boxShadow: '0 12px 40px rgba(255,0,0,0.3)', zIndex: 50,
        }}>
          <span style={{ color: '#FF0000', fontWeight: 700, fontSize: 13 }}>
            {selected.length} reel{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
          </span>
          <Link
            href={`/proto/reels-prep?reel=${selected.join(',')}`}
            style={{
              padding: '8px 14px', background: '#FF0000', color: '#fff',
              borderRadius: 7, fontSize: 12, fontWeight: 700,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            📋 Préparer ces {selected.length}
          </Link>
          <button onClick={() => setSelected([])} style={{
            padding: '8px 12px', background: 'transparent', color: '#888',
            border: '1px solid #262626', borderRadius: 7, fontSize: 11, cursor: 'pointer',
          }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', background: 'transparent', color: '#666',
  border: '1px solid #262626', borderRadius: 8, fontSize: 12,
  cursor: 'not-allowed', opacity: 0.5,
  whiteSpace: 'nowrap',
}
