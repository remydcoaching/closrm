'use client'

import type { FunnelBlockType } from '@/types'

interface Props {
  onAddBlock: (type: FunnelBlockType) => void
}

const BLOCK_OPTIONS: { type: FunnelBlockType; label: string; emoji: string }[] = [
  { type: 'hero', label: 'Hero', emoji: '\uD83C\uDFAF' },
  { type: 'video', label: 'Video', emoji: '\uD83C\uDFAC' },
  { type: 'testimonials', label: 'Temoignages', emoji: '\uD83D\uDCAC' },
  { type: 'form', label: 'Formulaire', emoji: '\uD83D\uDCDD' },
  { type: 'booking', label: 'Reservation', emoji: '\uD83D\uDCC5' },
  { type: 'pricing', label: 'Tarification', emoji: '\uD83D\uDCB0' },
  { type: 'faq', label: 'FAQ', emoji: '\u2753' },
  { type: 'countdown', label: 'Compte a rebours', emoji: '\u23F0' },
  { type: 'cta', label: 'Bouton CTA', emoji: '\uD83D\uDD18' },
  { type: 'text', label: 'Texte', emoji: '\uD83D\uDCC4' },
  { type: 'image', label: 'Image', emoji: '\uD83D\uDDBC\uFE0F' },
  { type: 'spacer', label: 'Espacement', emoji: '\u2195\uFE0F' },
]

export default function FunnelBlockPalette({ onAddBlock }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#555',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '0 8px 8px',
      }}>
        Blocs
      </div>
      {BLOCK_OPTIONS.map(opt => (
        <button
          key={opt.type}
          onClick={() => onAddBlock(opt.type)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: '#ccc',
            border: '1px solid transparent', borderRadius: 8,
            cursor: 'pointer', textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1a1a1a'
            e.currentTarget.style.borderColor = '#333'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{opt.emoji}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
