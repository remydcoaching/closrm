'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailBroadcast } from '@/types'

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<EmailBroadcast[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/emails/broadcasts')
      .then(r => r.json())
      .then(data => { setBroadcasts(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette campagne ?')) return
    await fetch(`/api/emails/broadcasts/${id}`, { method: 'DELETE' })
    setBroadcasts(b => b.filter(bc => bc.id !== id))
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: '#888' },
    scheduled: { label: 'Planifié', color: '#D69E2E' },
    sending: { label: 'Envoi en cours', color: '#3B82F6' },
    sent: { label: 'Envoyé', color: '#00C853' },
    failed: { label: 'Échoué', color: '#E53E3E' },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Campagnes</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Emails ponctuels envoyés à une audience ciblée
          </p>
        </div>
        <button onClick={() => router.push('/acquisition/emails/broadcasts/new')} style={{
          padding: '8px 18px', fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer',
        }}>
          + Nouvelle campagne
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: 13 }}>Chargement...</div>
      ) : broadcasts.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#555', fontSize: 13,
          background: '#141414', borderRadius: 12, border: '1px solid #262626',
        }}>
          Aucune campagne. Envoie ton premier email de masse !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {broadcasts.map(bc => {
            const st = statusLabel[bc.status] || statusLabel.draft
            return (
              <div key={bc.id} style={{
                background: '#141414', border: '1px solid #262626', borderRadius: 12,
                padding: '16px 20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{bc.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: `${st.color}18`, color: st.color,
                    }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#555' }}>
                    {bc.status === 'sent'
                      ? `${bc.sent_count}/${bc.total_count} envoyés`
                      : bc.subject || 'Pas de sujet'}
                  </div>
                </div>
                <button onClick={() => handleDelete(bc.id)} style={{
                  fontSize: 11, color: '#555', background: 'none', border: '1px solid #333',
                  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                }}>
                  Supprimer
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
