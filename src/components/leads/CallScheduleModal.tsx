'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Lead } from '@/types'

interface CallScheduleModalProps {
  lead: Lead
  onClose: () => void
  onScheduled: () => void
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const,
  padding: '8px 12px',
  background: '#0f0f11', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
}

const labelStyle = { fontSize: 12, color: '#888', marginBottom: 5, display: 'block' }

export default function CallScheduleModal({ lead, onClose, onScheduled }: CallScheduleModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'setting' as 'setting' | 'closing',
    scheduled_at: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.scheduled_at) { setError('La date est requise.'); return }

    setLoading(true)
    try {
      // Créer l'appel dans la table calls
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          type: form.type,
          scheduled_at: form.scheduled_at,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        // Fallback si l'API calls n'est pas encore implémentée par Pierre :
        // on met à jour le statut du lead directement
        const newStatus = form.type === 'setting' ? 'setting_planifie' : 'closing_planifie'
        await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      }

      onScheduled()
      onClose()
    } catch {
      setError('Erreur lors de la planification.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#0f0f11', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 400,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Planifier un appel</h2>
            <p style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{lead.first_name} {lead.last_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Type d&apos;appel</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['setting', 'closing'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('type', t)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: form.type === t ? '1px solid #00C853' : '1px solid rgba(255,255,255,0.08)',
                  background: form.type === t ? 'rgba(0,200,83,0.10)' : 'transparent',
                  color: form.type === t ? '#00C853' : '#666', cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Date et heure *</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }} />
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Notes sur cet appel..."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13,
              border: '1px solid rgba(255,255,255,0.10)', background: 'transparent',
              color: '#888', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: loading ? 'rgba(0,200,83,0.5)' : '#00C853', border: 'none',
              color: '#000', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Planifier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
