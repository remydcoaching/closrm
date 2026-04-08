'use client'

/**
 * T-028c — FaqBlock migré vers le design system v2.
 *
 * Accordéon questions/réponses. Adopte le langage visuel du design system :
 * - couleurs via `--fnl-text` et `--fnl-text-secondary`
 * - bordures teintées par `--fnl-primary-rgb`
 * - icône de toggle (+ / −) en couleur principale
 * - animation douce sur l'ouverture/fermeture
 *
 * Avant : couleurs hardcodées (#111, #888, #555, #eee).
 * Après : tout passe par les CSS vars du preset.
 *
 * Note technique : on garde le pattern open/close via `useState` interne par item
 * (pas besoin de remonter le state au parent — chaque item est indépendant).
 */

import { useState } from 'react'
import type { FaqBlockConfig } from '@/types'

interface Props {
  config: FaqBlockConfig
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(var(--fnl-primary-rgb), 0.12)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--fnl-text)',
          }}
        >
          {question}
        </span>
        <span
          style={{
            fontSize: 24,
            color: 'var(--fnl-primary)',
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: 12,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
            fontWeight: 300,
          }}
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: '0 0 20px',
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--fnl-text-secondary)',
          }}
        >
          {answer}
        </div>
      )}
    </div>
  )
}

export default function FaqBlock({ config }: Props) {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 720, margin: '0 auto' }}>
      {config.title && (
        <h2
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--fnl-primary)',
            margin: '0 0 32px',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {config.title}
        </h2>
      )}
      <div>
        {(config.items || []).map((item, i) => (
          <FaqItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  )
}
