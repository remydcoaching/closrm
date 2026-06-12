'use client'

import { useState } from 'react'
import { X, PhoneCall, PhoneOff, Check, Pencil } from 'lucide-react'
import { Lead } from '@/types'

interface EditingCall {
  callId: string
  reached: boolean
  notes: string | null
}

interface Props {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name'>
  onClose: () => void
  onLogged: (result: { reached: boolean; notes: string | null; isUpdate: boolean }) => void
  /** Si fourni, le modal s'ouvre en mode édition d'un call existant (PATCH au lieu de POST). */
  editing?: EditingCall
}

const inputS: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  resize: 'vertical',
  minHeight: 72,
}

export default function LogCallModal({ lead, onClose, onLogged, editing }: Props) {
  // Si on est en mode édition, on commence directement à l'étape notes
  // avec les valeurs pré-remplies.
  const [step, setStep] = useState<'reached' | 'notes' | 'success'>(editing ? 'notes' : 'reached')
  const [reached, setReached] = useState<boolean | null>(editing?.reached ?? null)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // L'ID du call déjà enregistré — set après le 1er POST ou hérité de editing.
  const [callId, setCallId] = useState<string | null>(editing?.callId ?? null)

  function pickReached(value: boolean) {
    setReached(value)
    setStep('notes')
  }

  async function submit() {
    if (reached === null) return
    setSubmitting(true)
    setError(null)
    try {
      const isUpdate = callId !== null
      const res = isUpdate
        ? await fetch(`/api/calls/${callId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reached, notes: notes.trim() || null }),
          })
        : await fetch('/api/calls/log-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: lead.id,
              reached,
              notes: notes.trim() || null,
            }),
          })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error?.formErrors?.[0] ?? j.error ?? 'Erreur')
      }
      const json = await res.json().catch(() => ({}))
      if (!isUpdate && json.data?.id) {
        setCallId(json.data.id)
      }
      onLogged({ reached, notes: notes.trim() || null, isUpdate })
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  function backToEdit() {
    setStep('reached')
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 14,
        padding: 24,
        width: '100%',
        maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editing || callId ? 'Modifier l\'appel' : 'Logger un appel'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {lead.first_name} {lead.last_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {step === 'reached' && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Tu as joint le lead ?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => pickReached(true)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 12px',
                  borderRadius: 12,
                  border: reached === true ? '2px solid #38A169' : '1px solid rgba(56,161,105,0.3)',
                  background: 'rgba(56,161,105,0.08)',
                  color: '#38A169',
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <PhoneCall size={22} />
                Oui, joint
              </button>
              <button
                onClick={() => pickReached(false)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 12px',
                  borderRadius: 12,
                  border: reached === false ? '2px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <PhoneOff size={22} />
                Pas de réponse
              </button>
            </div>
          </div>
        )}

        {step === 'notes' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 14,
              padding: '8px 12px', borderRadius: 8,
              background: reached ? 'rgba(56,161,105,0.08)' : 'rgba(239,68,68,0.08)',
              color: reached ? '#38A169' : '#ef4444',
              fontSize: 12, fontWeight: 600,
            }}>
              {reached ? <PhoneCall size={14} /> : <PhoneOff size={14} />}
              {reached ? 'Joint' : 'Pas de réponse'}
              <button
                onClick={() => setStep('reached')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Modifier
              </button>
            </div>

            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Notes (optionnel)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={reached ? 'Ce que vous vous êtes dit, prochaine étape...' : 'Répondeur, sonné dans le vide...'}
              style={inputS}
              autoFocus
            />

            {error && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                <Check size={14} />
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '24px 16px', borderRadius: 12,
              background: reached ? 'rgba(56,161,105,0.08)' : 'rgba(239,68,68,0.08)',
              marginBottom: 16,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 99,
                background: reached ? 'rgba(56,161,105,0.18)' : 'rgba(239,68,68,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: reached ? '#38A169' : '#ef4444',
              }}>
                <Check size={22} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Appel enregistré
                </div>
                <div style={{ fontSize: 12, color: reached ? '#38A169' : '#ef4444', marginTop: 4, fontWeight: 500 }}>
                  {reached ? 'Joint' : 'Pas de réponse'}
                </div>
                {notes.trim() && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                    « {notes.trim()} »
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={backToEdit}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Pencil size={13} />
                Modifier
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
