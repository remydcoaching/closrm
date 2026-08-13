'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

interface Props {
  results: ImportResult[]
  onConfirm: (payload: {
    handles: string[]
    create_follow_up: boolean
    follow_up_delay_days: number
    follow_up_reason: string
  }) => void
  submitting: boolean
}

export default function ReviewStep({ results, onConfirm, submitting }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(results.filter((r) => !r.already_exists).map((r) => r.handle)),
  )
  const [createFollowUp, setCreateFollowUp] = useState(true)
  const [delayDays, setDelayDays] = useState(7)
  const [reason, setReason] = useState('Nouveau follower — premier contact')

  const toggle = (handle: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })
  }

  const handleSubmit = () => {
    onConfirm({
      handles: [...selected],
      create_follow_up: createFollowUp,
      follow_up_delay_days: delayDays,
      follow_up_reason: reason,
    })
  }

  if (results.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        Aucun nouveau follower détecté sur ces captures.
      </p>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {results.map((r) => {
          const isSelected = selected.has(r.handle)
          return (
            <div
              key={r.handle}
              onClick={() => toggle(r.handle)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderBottom: '1px solid var(--border-primary)', cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: isSelected ? 'none' : '1.5px solid var(--border-primary)',
                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>@{r.handle}</span>
              {r.already_exists && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                  }}
                >
                  déjà en base
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={createFollowUp}
            onChange={(e) => setCreateFollowUp(e.target.checked)}
          />
          Créer une relance pour les leads sélectionnés
        </label>
        {createFollowUp && (
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Délai (jours)
              <input
                type="number"
                min={1}
                max={90}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                style={{
                  display: 'block', width: 80, marginTop: 4, padding: '6px 8px',
                  border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Raison
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: 4, padding: '6px 8px',
                  border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
              />
            </label>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected.size === 0 || submitting}
        style={{
          padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: 'var(--color-primary)', color: '#000', border: 'none',
          cursor: selected.size === 0 || submitting ? 'not-allowed' : 'pointer',
          opacity: selected.size === 0 || submitting ? 0.5 : 1,
        }}
      >
        {submitting ? 'Création…' : `Créer ${selected.size} lead${selected.size > 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
