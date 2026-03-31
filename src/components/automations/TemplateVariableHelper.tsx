'use client'

import { useState } from 'react'

const VARIABLES = [
  '{{prenom}}',
  '{{nom}}',
  '{{email}}',
  '{{telephone}}',
  '{{date_rdv}}',
  '{{heure_rdv}}',
  '{{nom_coach}}',
  '{{lieu}}',
  '{{lien_booking}}',
]

interface Props {
  onInsert?: (variable: string) => void
}

export default function TemplateVariableHelper({ onInsert }: Props) {
  const [copied, setCopied] = useState<string | null>(null)

  const handleClick = (variable: string) => {
    if (onInsert) {
      onInsert(variable)
    } else {
      navigator.clipboard.writeText(variable)
    }
    setCopied(variable)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div
      style={{
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-primary)',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        Variables disponibles
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleClick(v)}
            style={{
              fontSize: 11,
              background: copied === v ? 'rgba(0,200,83,0.25)' : 'rgba(0,200,83,0.1)',
              color: 'var(--color-primary)',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              border: 'none',
              margin: 2,
              transition: 'background 0.15s',
            }}
          >
            {copied === v ? '✓ Copié' : v}
          </button>
        ))}
      </div>
    </div>
  )
}
