import { Activity } from 'lucide-react'
import type { ActivityEvent } from '@/lib/dashboard/queries'

interface RecentActivityProps {
  events: ActivityEvent[]
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `il y a ${minutes}min`
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'hier'
  return `il y a ${days}j`
}

const TYPE_CONFIG = {
  new_lead:    { label: 'Nouveau lead', color: 'var(--color-primary)' },
  call_logged: { label: 'Appel logué',  color: '#3b82f6' },
}

export default function RecentActivity({ events }: RecentActivityProps) {
  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 14,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={14} color="var(--text-tertiary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Activité récente</span>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Aucune activité pour le moment</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((event, i) => {
            const cfg = TYPE_CONFIG[event.type]
            return (
              <div
                key={event.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 12, padding: '7px 0',
                  borderBottom: i < events.length - 1 ? '1px solid var(--border-primary)' : 'none',
                }}
              >
                <span style={{
                  color: cfg.color, fontSize: 11, fontWeight: 600,
                  width: 90, flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
                <span style={{ color: '#ccc', flex: 1 }}>{event.description}</span>
                <span style={{ color: 'var(--text-label)', fontSize: 11, flexShrink: 0 }}>
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
