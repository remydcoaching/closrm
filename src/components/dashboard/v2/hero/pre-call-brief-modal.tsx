'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, AlertCircle } from 'lucide-react'

interface BriefContent {
  summary: string[]
  questions: string[]
  risks: string[]
}

interface Props {
  open: boolean
  bookingId: string | null
  leadId: string | null
  onClose: () => void
}

export default function PreCallBriefModal({ open, bookingId, leadId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState<BriefContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  useEffect(() => {
    if (!open || !leadId) return
    setLoading(true)
    setBrief(null)
    setError(null)
    fetch('/api/dashboard/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, booking_id: bookingId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          setBrief(data.brief)
          setCached(data.cached)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, leadId, bookingId])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
              fontSize: 18,
              color: 'var(--text-primary)',
            }}
          >
            <Sparkles size={18} color="var(--color-primary)" /> Brief pré-call
            {cached && (
              <span
                style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}
              >
                (cache)
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
            Génération en cours…
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 12,
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              color: 'var(--color-danger)',
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {brief && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Résumé" items={brief.summary} />
            <Section title="Questions d'ouverture" items={brief.questions} />
            <Section title="Risques / objections" items={brief.risks} />
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-label)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
        }}
      >
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}
