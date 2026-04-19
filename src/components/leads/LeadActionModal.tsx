'use client'

import { useEffect, useState } from 'react'
import { X, Phone, Clock, RotateCcw, Skull, MessageCircle, Calendar, Send, Trophy } from 'lucide-react'
import { Lead, WorkspaceMemberWithUser } from '@/types'

interface Props {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name'>
  onClose: () => void
  onAction: (action: LeadAction) => void
}

export type LeadAction =
  | { type: 'schedule_call'; leadId: string }
  | { type: 'follow_up'; date: string; reason: string; channel: string }
  | { type: 'won'; amount: number; installments: number; cash_collected: number; duration_months: number | null; closer_id: string | null; setter_id: string | null }
  | { type: 'dead' }

const INSTALLMENT_OPTIONS = [
  { value: 1, label: 'Unique' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 6, label: '6x' },
  { value: 12, label: '12x' },
]

export default function LeadActionModal({ lead, onClose, onAction }: Props) {
  const [mode, setMode] = useState<'menu' | 'reschedule' | 'won'>('menu')

  // Reschedule state
  const [days, setDays] = useState(2)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')
  const [reason, setReason] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [channel, setChannel] = useState('manuel')

  // Won state
  const [dealAmount, setDealAmount] = useState('')
  const [installments, setInstallments] = useState(1)
  const [cashCollected, setCashCollected] = useState('')
  const [durationMonths, setDurationMonths] = useState<number | null>(null)
  const [closerId, setCloserId] = useState<string>('')
  const [setterId, setSetterId] = useState<string>('')
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetch('/api/workspaces/members').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/auth/me').then(r => r.ok ? r.json() : { data: null }),
    ]).then(([mem, me]) => {
      setMembers(mem.data ?? [])
      const uid = me?.data?.userId ?? me?.data?.id
      if (uid) {
        setCurrentUserId(uid)
        if (me.data.role === 'closer' || me.data.role === 'admin') {
          setCloserId(uid)
        }
      }
    }).catch(() => { /* ignore */ })
  }, [])

  useEffect(() => {
    const amount = parseFloat(dealAmount)
    if (!isNaN(amount) && amount > 0) {
      setCashCollected(String(Math.round((amount / installments) * 100) / 100))
    }
  }, [dealAmount, installments])

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
    onAction({ type: 'follow_up', date, reason: reason || `Relance dans ${days} jour${days > 1 ? 's' : ''}`, channel })
    onClose()
  }

  function handleWon() {
    const amount = parseFloat(dealAmount)
    const cash = parseFloat(cashCollected)
    if (isNaN(amount) || amount <= 0) return
    onAction({
      type: 'won',
      amount,
      installments,
      cash_collected: isNaN(cash) ? 0 : cash,
      duration_months: durationMonths,
      closer_id: closerId || null,
      setter_id: setterId || null,
    })
    onClose()
  }

  const wonValid = !isNaN(parseFloat(dealAmount)) && parseFloat(dealAmount) > 0

  const presets = [
    { label: 'Demain', d: 1 },
    { label: '2 jours', d: 2 },
    { label: '1 semaine', d: 7 },
    { label: '2 semaines', d: 14 },
    { label: '1 mois', d: 30 },
  ]

  const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }

  const title = mode === 'menu' ? 'Traiter ce lead' : mode === 'reschedule' ? 'Programmer une relance' : 'Gagné — valider la vente'

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{lead.first_name} {lead.last_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {mode === 'menu' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Prospect intéressé</div>
              <ActionButton icon={Phone} label="Planifier un RDV" desc="Le prospect est chaud → planifier un appel" color="var(--color-primary)" onClick={() => { onAction({ type: 'schedule_call', leadId: lead.id }); onClose() }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Relancer plus tard</div>
              <ActionButton icon={RotateCcw} label="Programmer une relance" desc="Choisir quand relancer ce lead" color="#3b82f6" onClick={() => setMode('reschedule')} />
              <ActionButton icon={MessageCircle} label="Nurturing (1 mois)" desc="Pas prêt, relancer dans 1 mois avec du contenu" color="#a855f7" onClick={() => { onAction({ type: 'follow_up', date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); d.setHours(9, 0, 0, 0); return d.toISOString() })(), reason: 'Nurturing — relance dans 1 mois', channel: 'manuel' }); onClose() }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>C&apos;est vendu</div>
              <ActionButton icon={Trophy} label="Gagné — valider la vente" desc="Montant, mode de paiement, encaissement" color="#38A169" onClick={() => setMode('won')} />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Abandonner</div>
              <ActionButton icon={Skull} label="Dead — abandonner ce lead" desc="Plus de potentiel" color="#ef4444" onClick={() => { onAction({ type: 'dead' }); onClose() }} />
            </div>
          </div>
        )}

        {mode === 'reschedule' && (
          <div>
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

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Canal</div>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...inputS, cursor: 'pointer' }}>
                <option value="manuel">Manuel</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="instagram_dm">Instagram DM</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Raison (optionnel)</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Envoi vidéo témoignage" style={inputS} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setMode('menu')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Retour</button>
              <button onClick={handleReschedule} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Send size={14} />Programmer
              </button>
            </div>
          </div>
        )}

        {mode === 'won' && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' }}>Montant total du deal</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={dealAmount}
                  onChange={(e) => setDealAmount(e.target.value)}
                  placeholder="3000"
                  min={0}
                  style={{ ...inputS, paddingRight: 36 }}
                  autoFocus
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Mode de paiement</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {INSTALLMENT_OPTIONS.map((opt) => {
                  const active = installments === opt.value
                  return (
                    <button key={opt.value} onClick={() => setInstallments(opt.value)} style={{
                      flex: 1, padding: '8px 2px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: active ? '2px solid #38A169' : '1px solid var(--border-primary)',
                      background: active ? 'rgba(56,161,105,0.10)' : 'transparent',
                      color: active ? '#38A169' : 'var(--text-muted)',
                    }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' }}>Encaissé aujourd&apos;hui</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={cashCollected}
                  onChange={(e) => setCashCollected(e.target.value)}
                  placeholder="0"
                  min={0}
                  style={{ ...inputS, paddingRight: 36 }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>€</span>
              </div>
              {(() => {
                const a = parseFloat(dealAmount)
                const c = parseFloat(cashCollected)
                if (!isNaN(a) && !isNaN(c) && a > 0) {
                  const remaining = Math.max(0, a - c)
                  const remainingPerInstallment = installments > 1 ? remaining / (installments - (c > 0 ? 1 : 0)) : remaining
                  return (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      Reste à payer : <strong style={{ color: 'var(--text-primary)' }}>{remaining.toFixed(0)}€</strong>
                      {installments > 1 && remaining > 0 && ` (soit ~${remainingPerInstallment.toFixed(0)}€ × ${installments - (c > 0 ? 1 : 0)} fois)`}
                    </div>
                  )
                }
                return null
              })()}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, display: 'block' }}>Durée d&apos;engagement</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {([
                  { v: null, l: 'Aucune' },
                  { v: 3, l: '3 mois' },
                  { v: 6, l: '6 mois' },
                  { v: 12, l: '12 mois' },
                  { v: 24, l: '24 mois' },
                ] as const).map(opt => {
                  const active = durationMonths === opt.v
                  return (
                    <button
                      key={opt.l}
                      onClick={() => setDurationMonths(opt.v)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        border: active ? '2px solid #38A169' : '1px solid var(--border-primary)',
                        background: active ? 'rgba(56,161,105,0.10)' : 'transparent',
                        color: active ? '#38A169' : 'var(--text-muted)',
                      }}
                    >
                      {opt.l}
                    </button>
                  )
                })}
              </div>
              {durationMonths != null && parseFloat(dealAmount) > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  MRR : <strong style={{ color: 'var(--text-primary)' }}>{(parseFloat(dealAmount) / durationMonths).toFixed(0)}€/mois</strong> pendant {durationMonths} mois
                </div>
              )}
            </div>

            {members.length > 0 && (
              <div style={{ marginBottom: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }}>Closer</label>
                  <select value={closerId} onChange={e => setCloserId(e.target.value)} style={{ ...inputS, cursor: 'pointer' }}>
                    <option value="">—</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user.full_name || m.user.email}{m.user_id === currentUserId ? ' (moi)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }}>Setter</label>
                  <select value={setterId} onChange={e => setSetterId(e.target.value)} style={{ ...inputS, cursor: 'pointer' }}>
                    <option value="">—</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user.full_name || m.user.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setMode('menu')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Retour</button>
              <button
                onClick={handleWon}
                disabled={!wonValid}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: wonValid ? 'pointer' : 'not-allowed',
                  background: wonValid ? '#38A169' : 'rgba(56,161,105,0.2)',
                  color: wonValid ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Trophy size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />Valider la vente
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
