'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle, Calendar, ExternalLink, Trash2 } from 'lucide-react'
import { Call, Lead } from '@/types'
import CallOutcomeBadge from './CallOutcomeBadge'
import CallTypeBadge from './CallTypeBadge'

type CallWithLead = Call & { lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'> }

interface Props {
  calls: CallWithLead[]
  loading: boolean
  onOutcome: (call: CallWithLead) => void
  onReschedule: (call: CallWithLead) => void
  onDelete: (call: CallWithLead) => void
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid rgba(255,255,255,0.06)' }
const td: React.CSSProperties = { padding: '12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }

export default function CallTable({ calls, loading, onOutcome, onReschedule, onDelete }: Props) {
  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>Chargement...</div>
  if (calls.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: '#555', fontSize: 13 }}>Aucun appel dans cette catégorie</div>

  const now = new Date()

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Date / Heure</th>
            <th style={th}>Lead</th>
            <th style={th}>Type</th>
            <th style={th}>#</th>
            <th style={th}>Statut</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const scheduled = new Date(call.scheduled_at)
            const overdue = call.outcome === 'pending' && scheduled < now

            return (
              <tr key={call.id} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {overdue && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />}
                    <div>
                      <div style={{ color: overdue ? '#ef4444' : '#fff', fontWeight: 500 }}>
                        {format(scheduled, "dd MMM yyyy", { locale: fr })}
                      </div>
                      <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                        {format(scheduled, "HH'h'mm", { locale: fr })}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 500, color: '#fff' }}>{call.lead.first_name} {call.lead.last_name}</div>
                  <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{call.lead.phone || call.lead.email || '—'}</div>
                </td>
                <td style={td}><CallTypeBadge type={call.type} /></td>
                <td style={{ ...td, color: '#666' }}>#{call.attempt_number}</td>
                <td style={td}><CallOutcomeBadge outcome={call.outcome} /></td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => onOutcome(call)} title="Résultat" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={14} color="#00C853" />
                    </button>
                    <button onClick={() => onReschedule(call)} title="Reprogrammer" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={14} color="#3b82f6" />
                    </button>
                    <Link href={`/leads/${call.lead.id}`} title="Voir fiche" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ExternalLink size={14} color="#888" />
                    </Link>
                    <button onClick={() => onDelete(call)} title="Supprimer" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
