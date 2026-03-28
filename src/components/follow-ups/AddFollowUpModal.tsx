'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock, MessageCircle, Mail, User } from 'lucide-react'
import { Lead, FollowUpChannel } from '@/types'

interface Props {
  onClose: () => void
  onCreated: () => void
  preselectedLead?: Pick<Lead, 'id' | 'first_name' | 'last_name'> | null
}

const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none' }
const lblS: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block', letterSpacing: '0.1em', textTransform: 'uppercase' as const }

export default function AddFollowUpModal({ onClose, onCreated, preselectedLead }: Props) {
  const [leads, setLeads] = useState<Pick<Lead, 'id' | 'first_name' | 'last_name'>[]>([])
  const [leadId, setLeadId] = useState(preselectedLead?.id || '')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [channel, setChannel] = useState<FollowUpChannel>('manuel')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!preselectedLead) {
      fetch('/api/leads?per_page=100&sort=first_name&order=asc').then(r => r.json()).then(j => setLeads(j.data || []))
    }
  }, [preselectedLead])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId) { setError('Sélectionnez un lead.'); return }
    if (!reason) { setError('La raison est requise.'); return }
    if (!date) { setError('La date est requise.'); return }

    setLoading(true); setError('')
    const res = await fetch('/api/follow-ups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, reason, scheduled_at: new Date(`${date}T${time}`).toISOString(), channel, notes: notes || null }),
    })
    if (!res.ok) { setError('Erreur lors de la création.'); setLoading(false); return }
    onCreated(); onClose()
  }

  const channels: { value: FollowUpChannel; label: string; icon: typeof MessageCircle; color: string }[] = [
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#22c55e' },
    { value: 'email', label: 'Email', icon: Mail, color: '#3b82f6' },
    { value: 'manuel', label: 'Manuel', icon: User, color: '#888' },
  ]

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0f0f11', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Créer un follow-up</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><X size={18} /></button>
        </div>

        <form onSubmit={submit}>
          {/* Lead selection */}
          {preselectedLead ? (
            <div style={{ marginBottom: 18 }}>
              <label style={lblS}>Lead</label>
              <div style={{ ...inputS, background: '#0f0f11', color: '#ccc' }}>{preselectedLead.first_name} {preselectedLead.last_name}</div>
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <label style={lblS}>Lead *</label>
              <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={{ ...inputS, colorScheme: 'dark' }}>
                <option value="">Sélectionner un lead</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>)}
              </select>
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: 18 }}>
            <label style={lblS}>Raison *</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputS} placeholder="Ex: Relance après no-show" />
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <div>
              <label style={lblS}>Date *</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputS, paddingLeft: 38, colorScheme: 'dark' }} />
              </div>
            </div>
            <div>
              <label style={lblS}>Heure</label>
              <div style={{ position: 'relative' }}>
                <Clock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputS, paddingLeft: 38, colorScheme: 'dark' }} />
              </div>
            </div>
          </div>

          {/* Channel */}
          <div style={{ marginBottom: 18 }}>
            <label style={lblS}>Canal</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {channels.map((ch) => {
                const active = channel === ch.value
                const Icon = ch.icon
                return (
                  <button key={ch.value} type="button" onClick={() => setChannel(ch.value)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: active ? `2px solid ${ch.color}` : '1px solid rgba(255,255,255,0.06)',
                    background: active ? `${ch.color}12` : 'transparent', color: active ? ch.color : '#666',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <Icon size={13} />{ch.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={lblS}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes..." style={{ ...inputS, resize: 'vertical' as const }} />
          </div>

          {error && <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.06)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 13, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#888', cursor: 'pointer' }}>Annuler</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#00C853', border: 'none', color: '#fff', cursor: 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {loading && <Loader2 size={14} />}Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
