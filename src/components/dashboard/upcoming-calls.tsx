'use client'

import { Phone } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { UpcomingCall } from '@/lib/dashboard/queries'

interface UpcomingCallsProps {
  calls: UpcomingCall[]
  onLeadClick: (leadId: string) => void
}

const CATEGORY_CONFIG = {
  overdue: { label: 'En retard', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: '#ef4444' },
  today:   { label: "Aujourd'hui", color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: '#f59e0b' },
  upcoming: { label: 'À venir', color: 'var(--text-tertiary)', bg: 'var(--bg-hover)', border: 'var(--text-label)' },
}

export default function UpcomingCalls({ calls, onLeadClick }: UpcomingCallsProps) {
  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Phone size={14} color="#f59e0b" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Prochains appels</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aujourd&apos;hui + 7j</span>
      </div>

      {calls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Phone size={22} color="var(--text-label)" />
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10 }}>Aucun appel planifié</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calls.map((call) => {
            const cfg = CATEGORY_CONFIG[call.category]
            return (
              <button
                key={call.id}
                onClick={() => onLeadClick(call.lead_id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: 'var(--bg-input)',
                  borderRadius: 8,
                  border: 'none',
                  borderLeft: `2px solid ${cfg.border}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{call.lead_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {call.type === 'setting' ? 'Setting' : 'Closing'} ·{' '}
                    {format(new Date(call.scheduled_at), "d MMM 'à' HH'h'mm", { locale: fr })}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, color: cfg.color, background: cfg.bg,
                  padding: '3px 8px', borderRadius: 99, flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
