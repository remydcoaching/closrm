'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Send, Trash2 } from 'lucide-react'
import type { EmailBroadcast } from '@/types'

interface BroadcastsClientProps {
  initialBroadcasts: EmailBroadcast[]
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Brouillon', color: '#888', bg: 'rgba(136,136,136,0.1)' },
  scheduled: { label: 'Planifié', color: '#D69E2E', bg: 'rgba(214,158,46,0.1)' },
  sending: { label: 'Envoi...', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  sent: { label: 'Envoyé', color: '#00C853', bg: 'rgba(0,200,83,0.1)' },
  failed: { label: 'Échoué', color: '#E53E3E', bg: 'rgba(229,62,62,0.1)' },
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 10,
  fontWeight: 700,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  borderBottom: '1px solid #262626',
}

const tdStyle: React.CSSProperties = {
  padding: '14px',
  fontSize: 13,
  borderBottom: '1px solid #1a1a1a',
  verticalAlign: 'middle',
}

export default function BroadcastsClient({ initialBroadcasts }: BroadcastsClientProps) {
  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>(initialBroadcasts)
  const router = useRouter()

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer cette campagne ?')) return
    await fetch(`/api/emails/broadcasts/${id}`, { method: 'DELETE' })
    setBroadcasts(b => b.filter(bc => bc.id !== id))
  }

  function handleRowClick(bc: EmailBroadcast) {
    if (bc.status === 'draft') {
      router.push(`/acquisition/emails/broadcasts/new?id=${bc.id}`)
    } else {
      router.push(`/acquisition/emails/broadcasts/${bc.id}`)
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '\u2014'
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Campagnes</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Emails ponctuels envoyés à une audience ciblée
          </p>
        </div>
        <button
          onClick={() => router.push('/acquisition/emails/broadcasts/new')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            background: '#E53E3E',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          Nouvelle campagne
        </button>
      </div>

      {/* Empty state */}
      {broadcasts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 72,
          background: '#141414',
          borderRadius: 14,
          border: '1px solid #262626',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(229,62,62,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Send size={22} color="#E53E3E" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
            Aucune campagne
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
            Envoie ton premier email de masse à tes contacts
          </div>
          <button
            onClick={() => router.push('/acquisition/emails/broadcasts/new')}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: '#E53E3E',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Créer une campagne
          </button>
        </div>
      ) : (
        /* Table */
        <div style={{
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nom</th>
                  <th style={thStyle}>Sujet</th>
                  <th style={thStyle}>Destinataires</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Date d&apos;envoi</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map(bc => {
                  const st = STATUS_MAP[bc.status] || STATUS_MAP.draft
                  return (
                    <tr
                      key={bc.id}
                      onClick={() => handleRowClick(bc)}
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>
                        {bc.name}
                      </td>
                      <td style={{ ...tdStyle, color: '#A0A0A0', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bc.subject || '\u2014'}
                      </td>
                      <td style={{ ...tdStyle, color: '#A0A0A0' }}>
                        {bc.status === 'sent'
                          ? `${bc.sent_count}/${bc.total_count}`
                          : bc.total_count > 0 ? String(bc.total_count) : '\u2014'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: st.bg,
                          color: st.color,
                        }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#666', fontSize: 12 }}>
                        {bc.status === 'sent' ? formatDate(bc.sent_at) : formatDate(bc.scheduled_at)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button
                          onClick={(e) => handleDelete(e, bc.id)}
                          title="Supprimer"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid #333',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={14} color="#666" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
