'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface GoogleIntegration {
  is_active: boolean
  connected_at: string | null
}

interface GoogleCalendarCardProps {
  integration: GoogleIntegration | null
}

export default function GoogleCalendarCard({ integration }: GoogleCalendarCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isConnected = !!integration?.is_active

  async function handleDisconnect() {
    if (!confirm('Déconnecter Google Agenda ? La synchronisation sera arrêtée.')) return
    setLoading(true)
    try {
      await fetch('/api/integrations/google_calendar', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const connectedAt = integration?.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${isConnected ? 'rgba(66,133,244,0.3)' : '#262626'}`,
      borderRadius: 12,
      padding: '16px 20px',
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
            {isConnected
              ? `Connecté${connectedAt ? ` le ${connectedAt}` : ''} — sync bidirectionnelle`
              : 'Synchronisez vos RDV automatiquement avec votre agenda Google'}
          </div>
        </div>
      </div>

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          style={{
            fontSize: 12,
            color: '#E53E3E',
            background: 'rgba(229,62,62,0.08)',
            border: '1px solid rgba(229,62,62,0.25)',
            borderRadius: 8,
            padding: '6px 14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : 'Déconnecter'}
        </button>
      ) : (
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
          }}
        >
          Connecter
        </a>
      )}
    </div>
  )
}
