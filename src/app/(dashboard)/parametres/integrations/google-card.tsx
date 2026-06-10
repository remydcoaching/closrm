'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface GoogleAccount {
  id: string
  email: string
  label: string | null
  color: string
  is_active: boolean
  connected_at: string
}

export default function GoogleCalendarCard() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/google-calendar-accounts')
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((json) => setAccounts(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDisconnect(accountId: string) {
    if (!confirm('Déconnecter ce compte Google Agenda ?')) return
    setDisconnecting(accountId)
    try {
      await fetch(`/api/google-calendar-accounts/${accountId}`, { method: 'DELETE' })
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      router.refresh()
    } finally {
      setDisconnecting(null)
    }
  }

  const hasAccounts = accounts.length > 0

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${hasAccounts ? 'rgba(66,133,244,0.3)' : '#262626'}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(66,133,244,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
            📅
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              Google Agenda
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              {hasAccounts
                ? `${accounts.length} compte${accounts.length > 1 ? 's' : ''} connecté${accounts.length > 1 ? 's' : ''}`
                : 'Synchronisez vos RDV avec votre agenda Google'}
            </div>
          </div>
        </div>

        <a
          href="/api/integrations/google/authorize"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4285F4',
            background: 'rgba(66,133,244,0.08)',
            border: '1px solid rgba(66,133,244,0.25)',
            borderRadius: 8,
            padding: '6px 14px',
            textDecoration: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {hasAccounts ? '+ Ajouter' : 'Connecter'}
        </a>
      </div>

      {/* Account list */}
      {!loading && accounts.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingLeft: 52,
        }}>
          {accounts.map((acc) => {
            const connectedAt = new Date(acc.connected_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })
            return (
              <div
                key={acc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: acc.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>
                      {acc.email}
                    </div>
                    <div style={{ fontSize: 10, color: '#555' }}>
                      Connecté le {connectedAt}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(acc.id)}
                  disabled={disconnecting === acc.id}
                  style={{
                    fontSize: 11,
                    color: '#E53E3E',
                    background: 'transparent',
                    border: 'none',
                    cursor: disconnecting === acc.id ? 'not-allowed' : 'pointer',
                    opacity: disconnecting === acc.id ? 0.5 : 1,
                    padding: '2px 8px',
                  }}
                >
                  {disconnecting === acc.id ? '...' : 'Retirer'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
