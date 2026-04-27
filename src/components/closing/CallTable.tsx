'use client'

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Phone, Sparkles, Trash2 } from 'lucide-react'
import { Call, Lead, WorkspaceMemberWithUser } from '@/types'
import CallOutcomeBadge from './CallOutcomeBadge'
import CallTypeBadge from './CallTypeBadge'
import MemberAssignDropdown from '@/components/shared/MemberAssignDropdown'

type CallWithLead = Call & {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status'>
  booking?: { id: string; booking_calendar: { name: string } | null }[] | null
}

interface Props {
  calls: CallWithLead[]
  loading: boolean
  onOutcome: (call: CallWithLead) => void
  onReschedule: (call: CallWithLead) => void
  onDelete: (call: CallWithLead) => void
  onCall: (call: CallWithLead) => void
  onTreat: (call: CallWithLead) => void
  onLeadClick: (leadId: string) => void
  members?: WorkspaceMemberWithUser[]
  onAssignCall?: (callId: string, userId: string | null) => void
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid var(--border-primary)' }
const td: React.CSSProperties = { padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', verticalAlign: 'middle' }

export default function CallTable({ calls, loading, onDelete, onCall, onTreat, onLeadClick, members = [], onAssignCall }: Props) {
  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-label)' }}>Chargement...</div>
  if (calls.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-label)', fontSize: 13 }}>Aucun appel dans cette catégorie</div>

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
            <th style={th}>Assigné</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const scheduled = new Date(call.scheduled_at)
            const overdue = call.outcome === 'pending' && scheduled < now

            return (
              <tr key={call.id} style={{ transition: 'background 0.15s', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => onLeadClick(call.lead.id)}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {overdue && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />}
                    <div>
                      <div style={{ color: overdue ? '#ef4444' : 'var(--text-primary)', fontWeight: 500 }}>
                        {format(scheduled, "dd MMM yyyy", { locale: fr })}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                        {format(scheduled, "HH'h'mm", { locale: fr })}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{call.lead.first_name} {call.lead.last_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{call.lead.phone || call.lead.email || '—'}</div>
                  {call.booking?.[0]?.booking_calendar?.name && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      via {call.booking[0].booking_calendar.name}
                    </div>
                  )}
                </td>
                <td style={td}><CallTypeBadge type={call.type} /></td>
                <td style={{ ...td, color: 'var(--text-muted)' }}>#{call.attempt_number}</td>
                <td style={td}><CallOutcomeBadge outcome={call.outcome} /></td>
                <td style={td} onClick={(e) => e.stopPropagation()}>
                  <MemberAssignDropdown
                    assignedTo={call.assigned_to}
                    members={members}
                    onAssign={(userId) => onAssignCall?.(call.id, userId)}
                    canEdit={!!onAssignCall}
                    compact
                  />
                </td>
                <td style={{ ...td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button onClick={() => onCall(call)} title="Appeler" style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '5px 7px', borderRadius: 6,
                      background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
                      color: '#3b82f6', cursor: 'pointer',
                    }}>
                      <Phone size={11} />
                    </button>
                    <button onClick={() => onTreat(call)} title="Traiter" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'rgba(0,200,83,0.10)', border: '1px solid rgba(0,200,83,0.20)',
                      color: 'var(--color-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      <Sparkles size={11} /> Traiter
                    </button>
                    <button onClick={() => onDelete(call)} title="Supprimer" style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '5px 7px', borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--border-primary)',
                      color: '#ef4444', cursor: 'pointer',
                    }}>
                      <Trash2 size={11} />
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
