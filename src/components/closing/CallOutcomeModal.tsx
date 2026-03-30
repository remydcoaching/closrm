'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Call, CallOutcome } from '@/types'
import { OUTCOME_CONFIG } from './CallOutcomeBadge'

interface Props {
  call: Call & { lead: { first_name: string; last_name: string } }
  onClose: () => void
  onUpdated: () => void
}

export default function CallOutcomeModal({ call, onClose, onUpdated }: Props) {
  const [outcome, setOutcome] = useState<CallOutcome>(call.outcome)
  const [reached, setReached] = useState(call.reached)
  const [duration, setDuration] = useState(call.duration_seconds ? Math.round(call.duration_seconds / 60) : 0)
  const [notes, setNotes] = useState(call.notes || '')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    await fetch(`/api/calls/${call.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, reached, duration_seconds: duration * 60, notes: notes || null }),
    })
    onUpdated()
    onClose()
  }

  const outcomes: CallOutcome[] = ['done', 'no_show', 'cancelled', 'pending']
  const input: React.CSSProperties = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Résultat de l&apos;appel</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
          {call.lead.first_name} {call.lead.last_name}
        </p>

        {/* Outcome buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {outcomes.map((o) => {
            const c = OUTCOME_CONFIG[o]
            const active = outcome === o
            return (
              <button key={o} onClick={() => setOutcome(o)} style={{
                padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: active ? `2px solid ${c.color}` : '1px solid var(--border-primary)',
                background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text-tertiary)',
              }}>
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Joint toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border-primary)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Joint ?</span>
          <button onClick={() => setReached(!reached)} style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: reached ? 'var(--color-primary)' : 'var(--border-primary)', position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: reached ? 21 : 3, transition: 'left 0.2s' }} />
          </button>
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Durée (minutes)</label>
          <input type="number" min={0} value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={input} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' as const }} placeholder="Notes sur l'appel..." />
        </div>

        <button onClick={submit} disabled={loading} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--color-primary)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
          opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? <Loader2 size={16} /> : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
