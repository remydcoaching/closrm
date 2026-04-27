'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'

interface Recipient {
  send_id: string
  lead_id: string | null
  status: string
  sent_at: string
  opened_at: string | null
  clicked_at: string | null
  bounced_at: string | null
  lead: { first_name: string | null; last_name: string | null; email: string } | null
}

interface StatsResponse {
  broadcast: {
    id: string
    name: string
    subject: string | null
    sent_at: string | null
    total_count: number
    sent_count: number
  }
  counts: {
    total: number
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }
  rates: { open: number; click: number; bounce: number }
  recipients: Recipient[]
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  sent: { label: 'Envoyé', bg: '#27272a', color: '#d4d4d8' },
  delivered: { label: 'Remis', bg: '#134e4a', color: '#5eead4' },
  opened: { label: 'Ouvert', bg: '#1e3a8a', color: '#93c5fd' },
  clicked: { label: 'Cliqué', bg: '#5b21b6', color: '#c4b5fd' },
  bounced: { label: 'Bounce', bg: '#7f1d1d', color: '#fca5a5' },
  complained: { label: 'Plainte', bg: '#713f12', color: '#fcd34d' },
}

export default function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/emails/broadcasts/${id}/stats`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 32, color: '#888' }}>Chargement...</div>
  }
  if (error || !data) {
    return <div style={{ padding: 32, color: '#ef4444' }}>{error || 'Erreur'}</div>
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <button
        onClick={() => router.push('/acquisition/emails/broadcasts')}
        style={{
          fontSize: 13,
          color: '#666',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        ← Retour aux campagnes
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
        {data.broadcast.name}
      </h1>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 24px' }}>
        {data.broadcast.subject || 'Sans sujet'}
        {data.broadcast.sent_at && (
          <> · Envoyé le {new Date(data.broadcast.sent_at).toLocaleString('fr-FR')}</>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}
      >
        <StatCard label="Envoyés" value={data.counts.total} color="#fff" />
        <StatCard label="Remis" value={data.counts.delivered} color="#5eead4" />
        <StatCard
          label="Ouverts"
          value={data.counts.opened}
          sub={`${data.rates.open}%`}
          color="#93c5fd"
        />
        <StatCard
          label="Cliqués"
          value={data.counts.clicked}
          sub={`${data.rates.click}%`}
          color="#c4b5fd"
        />
        <StatCard
          label="Bounces"
          value={data.counts.bounced}
          sub={`${data.rates.bounce}%`}
          color="#fca5a5"
        />
        <StatCard label="Plaintes" value={data.counts.complained} color="#fcd34d" />
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
        Destinataires ({data.recipients.length})
      </h2>

      <div
        style={{
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1a1a1a' }}>
              <Th>Destinataire</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Envoyé</Th>
              <Th>Ouvert</Th>
              <Th>Cliqué</Th>
            </tr>
          </thead>
          <tbody>
            {data.recipients.map((r) => {
              const style = STATUS_STYLE[r.status] || STATUS_STYLE.sent
              const name = r.lead
                ? [r.lead.first_name, r.lead.last_name].filter(Boolean).join(' ') || '—'
                : '—'
              return (
                <tr
                  key={r.send_id}
                  style={{
                    borderTop: '1px solid #262626',
                    cursor: r.lead_id ? 'pointer' : 'default',
                  }}
                  onClick={() => r.lead_id && router.push(`/leads/${r.lead_id}`)}
                >
                  <Td>{name}</Td>
                  <Td>{r.lead?.email || '—'}</Td>
                  <Td>
                    <span
                      style={{
                        background: style.bg,
                        color: style.color,
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {style.label}
                    </span>
                  </Td>
                  <Td>{formatDate(r.sent_at)}</Td>
                  <Td>{formatDate(r.opened_at)}</Td>
                  <Td>{formatDate(r.clicked_at)}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number
  sub?: string
  color: string
}) {
  return (
    <div
      style={{
        background: '#141414',
        border: '1px solid #262626',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 14px',
        fontSize: 11,
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '10px 14px', fontSize: 13, color: '#ddd' }}>
      {children}
    </td>
  )
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
