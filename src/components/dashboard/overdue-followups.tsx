import Link from 'next/link'
import { Clock } from 'lucide-react'
import type { OverdueFollowUp } from '@/lib/dashboard/queries'

interface OverdueFollowUpsProps {
  followUps: OverdueFollowUp[]
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  manuel: 'Manuel',
}

export default function OverdueFollowUps({ followUps }: OverdueFollowUpsProps) {
  const card: React.CSSProperties = {
    background: '#0f0f11',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color="#ef4444" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Follow-ups en retard</span>
        </div>
        {followUps.length > 0 ? (
          <span style={{
            fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)',
            padding: '3px 10px', borderRadius: 99, fontWeight: 600,
          }}>
            {followUps.length} en retard
          </span>
        ) : (
          <span style={{
            fontSize: 10, color: '#00C853', background: 'rgba(0,200,83,0.08)',
            padding: '3px 10px', borderRadius: 99, fontWeight: 600,
          }}>
            À jour
          </span>
        )}
      </div>

      {followUps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <Clock size={22} color="#333" />
          <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Aucun follow-up en retard</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {followUps.map((fu) => (
            <Link
              key={fu.id}
              href={`/leads/${fu.lead_id}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: '#0a0a0c', borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{fu.lead_name}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                  {CHANNEL_LABEL[fu.channel]}
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                -{fu.days_overdue}j
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
