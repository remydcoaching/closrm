'use client'

import { useEffect, useState } from 'react'
import { Video, Phone as PhoneIcon, Mail, Sparkles, ExternalLink } from 'lucide-react'
import type { NextBooking } from '@/lib/dashboard/v2-queries'

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const target = new Date(targetIso)
  const diff = target.getTime() - now
  if (diff <= 0) return 'maintenant'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `dans ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `dans ${hrs}h${(mins % 60).toString().padStart(2, '0')}`
  const days = Math.floor(hrs / 24)
  return `dans ${days} jour${days > 1 ? 's' : ''}`
}

interface Props {
  booking: NextBooking | null
  onGenerateBrief: (bookingId: string, leadId: string) => void
}

export default function NextCallCard({ booking, onGenerateBrief }: Props) {
  if (!booking) {
    return (
      <div style={cardStyle}>
        <div style={labelStyle}>PROCHAIN RDV</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>🎯 À jour</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Aucun RDV planifié dans les 7 prochains jours.
        </div>
      </div>
    )
  }

  return <ActiveCard booking={booking} onGenerateBrief={onGenerateBrief} />
}

function ActiveCard({
  booking,
  onGenerateBrief,
}: {
  booking: NextBooking
  onGenerateBrief: (b: string, l: string) => void
}) {
  const countdown = useCountdown(booking.scheduled_at)
  const target = new Date(booking.scheduled_at)
  const isToday = target.toDateString() === new Date().toDateString()
  const time = target.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = isToday
    ? `Aujourd'hui ${time}`
    : target.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }) + ` · ${time}`

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>PROCHAIN RDV</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
        {booking.lead_name}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-primary)',
          fontWeight: 600,
          marginTop: 4,
        }}
      >
        {dateLabel} · {countdown}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          fontSize: 12,
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
        }}
      >
        {booking.source && <span>📍 {booking.source.replaceAll('_', ' ')}</span>}
        {booking.email && (
          <span>
            <Mail size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
            {booking.email}
          </span>
        )}
        {booking.phone && (
          <span>
            <PhoneIcon size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
            {booking.phone}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {booking.meet_url && (
          <a href={booking.meet_url} target="_blank" rel="noopener noreferrer" style={primaryBtnStyle}>
            <Video size={14} /> Rejoindre Meet
          </a>
        )}
        <button
          onClick={() => onGenerateBrief(booking.id, booking.lead_id)}
          style={secondaryBtnStyle}
        >
          <Sparkles size={14} /> Générer brief IA
        </button>
        <a href={`/leads/${booking.lead_id}`} style={ghostBtnStyle}>
          <ExternalLink size={14} /> Fiche lead
        </a>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 200,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-label)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: 8,
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid var(--border-primary)',
  cursor: 'pointer',
}
const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid var(--border-primary)',
  textDecoration: 'none',
}
