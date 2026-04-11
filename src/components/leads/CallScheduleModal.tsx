'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock, UserCheck } from 'lucide-react'
import { Lead, WorkspaceMemberWithUser } from '@/types'

interface CallScheduleModalProps {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name'>
  onClose: () => void
  onScheduled: () => void
}

export default function CallScheduleModal({ lead, onClose, onScheduled }: CallScheduleModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState<'setting' | 'closing'>('setting')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [notes, setNotes] = useState('')
  const [closers, setClosers] = useState<WorkspaceMemberWithUser[]>([])
  const [nextCloser, setNextCloser] = useState<WorkspaceMemberWithUser | null>(null)

  useEffect(() => {
    fetch('/api/workspaces/members')
      .then(r => r.json())
      .then(json => {
        const members: WorkspaceMemberWithUser[] = json.data || []
        const closerMembers = members.filter(m => m.role === 'closer' && m.status === 'active')
        setClosers(closerMembers)
        if (closerMembers.length > 0) setNextCloser(closerMembers[0])
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { setError('La date est requise.'); return }
    if (!time) { setError("L'heure est requise."); return }

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, type, scheduled_at, notes: notes || undefined }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        let msg = 'Erreur lors de la planification.'
        if (typeof json?.error === 'string') msg = json.error
        else if (json?.error?.fieldErrors) {
          const fieldMsgs = Object.values(json.error.fieldErrors).flat()
          if (fieldMsgs.length) msg = fieldMsgs.join(', ')
        } else if (json?.error?.formErrors?.length) msg = json.error.formErrors.join(', ')
        else if (json?.details) msg = JSON.stringify(json.details)
        setError(msg)
        setLoading(false)
        return
      }

      onScheduled()
      onClose()
    } catch {
      setError('Erreur lors de la planification.')
    } finally {
      setLoading(false)
    }
  }

  const inputS: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px 10px 38px', background: 'var(--bg-input)',
    border: '1px solid var(--border-primary)', borderRadius: 10,
    color: 'var(--text-primary)', fontSize: 13, outline: 'none', colorScheme: 'dark',
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Planifier un appel</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{lead.first_name} {lead.last_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 8, display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Type d&apos;appel</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['setting', 'closing'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: type === t ? `2px solid ${t === 'setting' ? '#3b82f6' : '#a855f7'}` : '1px solid var(--border-primary)',
                  background: type === t ? (t === 'setting' ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)') : 'transparent',
                  color: type === t ? (t === 'setting' ? '#3b82f6' : '#a855f7') : 'var(--text-muted)',
                  textTransform: 'capitalize' as const,
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-assign info for closing */}
          {type === 'closing' && nextCloser && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, marginBottom: 18,
              background: 'rgba(56,161,105,0.08)', border: '1px solid rgba(56,161,105,0.2)',
            }}>
              <UserCheck size={16} color="#38A169" />
              <div>
                <span style={{ fontSize: 12, color: '#38A169', fontWeight: 600 }}>
                  Sera assigne a {nextCloser.user.full_name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                  (closer le moins charge)
                </span>
              </div>
            </div>
          )}
          {type === 'closing' && closers.length === 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 18,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 12, color: '#f59e0b',
            }}>
              Aucun closer dans l'equipe — le lead ne sera pas assigne automatiquement
            </div>
          )}

          {/* Date + Time side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 8, display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Date *</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)', pointerEvents: 'none' }} />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputS} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 8, display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Heure *</label>
              <div style={{ position: 'relative' }}>
                <Clock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)', pointerEvents: 'none' }} />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputS} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', marginBottom: 8, display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes sur cet appel..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical' as const }} />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', border: 'none', color: 'var(--text-primary)', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {loading && <Loader2 size={14} />}
              Planifier
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
