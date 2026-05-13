'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface YoutubeIntegration {
  is_active: boolean
  connected_at: string | null
}

interface YoutubeCardProps {
  integration: YoutubeIntegration | null
}

export default function YoutubeCard({ integration }: YoutubeCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isConnected = !!integration?.is_active

  async function handleDisconnect() {
    if (!confirm('Déconnecter YouTube ? Les vidéos déjà synchronisées sont conservées mais aucune publication ni sync ne sera faite tant que tu n\'auras pas reconnecté.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/youtube', { method: 'DELETE' })
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
      border: `1px solid ${isConnected ? 'rgba(255,0,0,0.3)' : '#262626'}`,
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
          background: 'rgba(255,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          🎥
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
            YouTube
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>
            {isConnected
              ? `Connecté${connectedAt ? ` le ${connectedAt}` : ''} — publication, sync vidéos & analytics`
              : 'Publie tes vidéos et synchronise tes analytics depuis ClosRM'}
          </div>
        </div>
      </div>

      {isConnected ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/api/integrations/youtube/authorize"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#FF0000',
              background: 'rgba(255,0,0,0.08)',
              border: '1px solid rgba(255,0,0,0.25)',
              borderRadius: 8,
              padding: '6px 14px',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Reconnecter
          </a>
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
        </div>
      ) : (
        <a
          href="/api/integrations/youtube/authorize"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#FF0000',
            background: 'rgba(255,0,0,0.08)',
            border: '1px solid rgba(255,0,0,0.25)',
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
