'use client'

import { useState } from 'react'
import { X, Phone, Clock, RotateCcw, Skull, MessageCircle, Calendar, Send } from 'lucide-react'
import { FollowUp, Lead } from '@/types'

interface Props {
  followUp: FollowUp & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name'> }
  onClose: () => void
  onAction: (action: FollowUpAction) => void
}

export type FollowUpAction =
  | { type: 'schedule_call'; leadId: string }
  | { type: 'reschedule'; date: string; reason: string; channel: string }
  | { type: 'dead' }

export default function FollowUpActionModal({ followUp, onClose, onAction }: Props) {
  const [mode, setMode] = useState<'menu' | 'reschedule'>('menu')
  const [days, setDays] = useState(2)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')
  const [reason, setReason] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)

  function handleReschedule() {
    let date: string
    if (useCustomDate && customDate) {
      date = new Date(`${customDate}T${customTime}`).toISOString()
    } else {
      const d = new Date()
      d.setDate(d.getDate() + days)
      d.setHours(9, 0, 0, 0)
      date = d.toISOString()
    }
    onAction({ type: 'reschedule', date, reason: reason || `Relance dans ${days} jour${days > 1 ? 's' : ''}`, channel: followUp.channel })
    onClose()
  }

  const presets = [
    { label: 'Demain', d: 1 },
    { label: '2 jours', d: 2 },
    { label: '1 semaine', d: 7 },
    { label: '2 semaines', d: 14 },
    { label: '1 mois', d: 30 },
  ]

  const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {mode === 'menu' ? 'Résultat de la relance' : 'Programmer la prochaine relance'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{followUp.lead.first_name} {followUp.lead.last_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {mode === 'menu' ? (
          <div>
            {/* Prospect intéressé */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Prospect intéressé</div>
              <ActionButton icon={Phone} label="Planifier un RDV" desc="Le prospect est chaud → planifier un appel" color="var(--color-primary)" onClick={() => { onAction({ type: 'schedule_call', leadId: followUp.lead.id }); onClose() }} />
            </div>

            {/* Relancer */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Relancer plus tard</div>
              <ActionButton icon={RotateCcw} label="Programmer une relance" desc="Choisir quand relancer ce lead" color="#3b82f6" onClick={() => setMode('reschedule')} />
              <ActionButton icon={MessageCircle} label="Nurturing (1 mois)" desc="Pas prêt, relancer dans 1 mois avec du contenu" color="#a855f7" onClick={() => { onAction({ type: 'reschedule', date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); d.setHours(9, 0, 0, 0); return d.toISOString() })(), reason: 'Nurturing — relance dans 1 mois', channel: followUp.channel }); onClose() }} />
            </div>

            {/* Abandonner */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Abandonner</div>
              <ActionButton icon={Skull} label="Dead — abandonner ce lead" desc="Plus de potentiel" color="#ef4444" onClick={() => { onAction({ type: 'dead' }); onClose() }} />
            </div>
          </div>
        ) : (
          <div>
            {/* Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Relancer dans</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets.map((p) => (
                  <button key={p.d} onClick={() => { setDays(p.d); setUseCustomDate(false) }} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: !useCustomDate && days === p.d ? '2px solid #3b82f6' : '1px solid var(--border-primary)',
                    background: !useCustomDate && days === p.d ? 'rgba(59,130,246,0.08)' : 'transparent',
                    color: !useCustomDate && days === p.d ? '#3b82f6' : 'var(--text-tertiary)',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setUseCustomDate(!useCustomDate)} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 8 }}>
                {useCustomDate ? '← Utiliser les presets' : 'Ou choisir une date précise →'}
              </button>
              {useCustomDate && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)', pointerEvents: 'none' }} />
                    <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={{ ...inputS, paddingLeft: 38, colorScheme: 'dark' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Clock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-label)', pointerEvents: 'none' }} />
                    <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} style={{ ...inputS, paddingLeft: 38, colorScheme: 'dark' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Raison (optionnel)</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Envoi vidéo témoignage" style={inputS} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setMode('menu')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Retour</button>
              <button onClick={handleReschedule} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Send size={14} />Programmer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, label, desc, color, onClick }: { icon: typeof Phone; label: string; desc: string; color: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', width: '100%',
      borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
      background: hovered ? 'var(--bg-hover)' : 'transparent', transition: 'background 0.15s', marginBottom: 4,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '12', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
    </button>
  )
}
