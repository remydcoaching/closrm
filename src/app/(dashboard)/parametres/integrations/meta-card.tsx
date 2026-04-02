'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MetaIntegration {
  is_active: boolean
  connected_at: string | null
  meta_page_id: string | null
}

interface MetaIntegrationCardProps {
  integration: MetaIntegration | null
}

export default function MetaIntegrationCard({ integration }: MetaIntegrationCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isConnected = !!integration?.is_active

  async function handleDisconnect() {
    if (!confirm('Déconnecter Meta Ads ? Les leads ne seront plus importés automatiquement.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/meta/disconnect', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        alert(`Erreur: ${err.error || 'Déconnexion échouée'}`)
        return
      }
      router.refresh()
    } catch {
      alert('Erreur réseau lors de la déconnexion')
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
      border: `1px solid ${isConnected ? 'rgba(24,119,242,0.3)' : '#262626'}`,
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
          background: 'rgba(24,119,242,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          📊
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Meta Ads</span>
            {isConnected && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#00C853',
                background: 'rgba(0,200,83,0.1)',
                border: '1px solid rgba(0,200,83,0.25)',
                borderRadius: 4,
                padding: '2px 7px',
              }}>
                CONNECTÉ
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>
            {isConnected
              ? `Page ID : ${integration?.meta_page_id ?? '—'} · Connecté le ${connectedAt}`
              : 'Import automatique des leads Facebook & Instagram Ads'}
          </div>
        </div>
      </div>

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Déconnexion...' : 'Déconnecter'}
        </button>
      ) : (
        <a
          href="/api/integrations/meta"
          style={{
            background: '#1877F2',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Connecter →
        </a>
      )}
    </div>
  )
}
