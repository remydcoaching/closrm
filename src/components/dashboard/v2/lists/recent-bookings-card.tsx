'use client'

import { CalendarPlus, ChevronRight } from 'lucide-react'
import type { RecentBookingsBucket } from '@/lib/dashboard/v2-queries'

function formatBookedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `il y a ${days}j`
}

function formatScheduled(iso: string): string {
  const target = new Date(iso)
  const now = new Date()
  const isSameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  const time = target.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isSameDay) return `Aujourd'hui ${time}`
  const tmw = new Date(now)
  tmw.setDate(tmw.getDate() + 1)
  if (
    target.getFullYear() === tmw.getFullYear() &&
    target.getMonth() === tmw.getMonth() &&
    target.getDate() === tmw.getDate()
  )
    return `Demain ${time}`
  return `${target.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`
}

export default function RecentBookingsCard({
  data,
  onLeadClick,
}: {
  data: RecentBookingsBucket
  onLeadClick: (leadId: string) => void
}) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarPlus size={14} color="#3b82f6" />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-label)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              Réservations récentes
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              <span style={{ color: '#3b82f6', fontWeight: 700 }}>{data.count_today}</span>{' '}
              aujourd&apos;hui · <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.count_7d}</span>{' '}
              sur 7 jours
            </div>
          </div>
        </div>
        <a
          href="/agenda"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Voir tout <ChevronRight size={12} />
        </a>
      </div>

      {data.bookings.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
          Aucune réservation sur les 7 derniers jours.
        </div>
      ) : (
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            margin: '0 -8px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Lead</th>
                <th style={thStyle}>RDV prévu</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pris</th>
                <th style={{ ...thStyle, width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map(b => (
                <tr
                  key={b.id}
                  onClick={() => {
                    if (b.lead_id) onLeadClick(b.lead_id)
                  }}
                  style={{
                    cursor: b.lead_id ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {b.lead_name}
                    </span>
                    {b.source && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--bg-elevated)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {b.source.replaceAll('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 12 }}>
                    {formatScheduled(b.scheduled_at)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                    }}
                  >
                    {formatBookedAt(b.booked_at)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {b.lead_id && <ChevronRight size={12} color="var(--text-muted)" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  padding: '8px 8px',
  borderBottom: '1px solid var(--border-primary)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid var(--border-primary)',
  fontSize: 13,
}
