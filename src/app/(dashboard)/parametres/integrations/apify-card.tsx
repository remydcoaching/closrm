'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ApifyIntegration {
  is_active: boolean
  connected_at: string | null
}

interface Props {
  integration: ApifyIntegration | null
}

export default function ApifyCard({ integration }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [apiToken, setApiToken] = useState('')
  const [actorId, setActorId] = useState('')
  const [error, setError] = useState('')

  const isConnected = !!integration?.is_active

  const connectedAt = integration?.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  async function handleConnect() {
    if (!apiToken.trim() || !actorId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'apify',
          credentials: { apiToken: apiToken.trim(), actorId: actorId.trim() },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la connexion')
        return
      }
      setShowForm(false)
      setApiToken('')
      setActorId('')
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Déconnecter Apify ? Le suivi des likes Instagram sera interrompu.')) return
    setLoading(true)
    try {
      await fetch('/api/integrations/apify', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${isConnected ? 'rgba(229,62,62,0.3)' : '#262626'}`,
      borderRadius: 12,
      padding: '16px 20px',
    }}>
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
            background: 'rgba(229,62,62,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
            🕷️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              Apify — Suivi des likes Instagram
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              {isConnected
                ? `Connecté depuis le ${connectedAt}`
                : 'Collecte externalisée (aucun scraping ClosRM)'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#E53E3E',
                background: 'rgba(229,62,62,0.08)',
                border: '1px solid rgba(229,62,62,0.2)',
                borderRadius: 8,
                padding: '6px 14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Déconnecter
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#E53E3E',
                background: 'rgba(229,62,62,0.1)',
                border: '1px solid rgba(229,62,62,0.25)',
                borderRadius: 8,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Connecter
            </button>
          )}
        </div>
      </div>

      {showForm && !isConnected && (
        <div style={{ marginTop: 16, borderTop: '1px solid #262626', paddingTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 6, display: 'block' }}>
              Token API Apify
            </label>
            <input
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              placeholder="apify_api_..."
              type="password"
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 6, display: 'block' }}>
              Actor ID
            </label>
            <input
              value={actorId}
              onChange={e => setActorId(e.target.value)}
              placeholder="instaprism~instagram-likers-scraper"
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.7, margin: '0 0 12px' }}>
            <div style={{ fontWeight: 600, color: '#888', marginBottom: 4 }}>Comment obtenir ces valeurs :</div>
            <div>1. Va sur <strong style={{ color: '#aaa' }}>console.apify.com/account#/integrations</strong></div>
            <div>2. Copie ton <strong style={{ color: '#aaa' }}>token API personnel</strong></div>
            <div>3. Va sur la page de l&apos;Actor &quot;Instagram Likers Scraper&quot; que tu utilises, l&apos;Actor ID est dans l&apos;URL ou l&apos;onglet API</div>
          </div>
          {error && (
            <p style={{ fontSize: 12, color: '#E53E3E', margin: '0 0 12px' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              style={{
                fontSize: 12,
                color: '#888',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleConnect}
              disabled={!apiToken.trim() || !actorId.trim() || loading}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: apiToken.trim() && actorId.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
                background: apiToken.trim() && actorId.trim() ? '#E53E3E' : 'rgba(229,62,62,0.3)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: apiToken.trim() && actorId.trim() ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Connexion...' : 'Connecter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
