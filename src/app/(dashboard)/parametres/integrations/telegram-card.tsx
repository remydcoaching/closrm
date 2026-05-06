'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TelegramIntegration {
  is_active: boolean
  connected_at: string | null
}

interface Props {
  integration: TelegramIntegration | null
}

export default function TelegramCard({ integration }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [error, setError] = useState('')
  const [testSending, setTestSending] = useState(false)

  const isConnected = !!integration?.is_active

  const connectedAt = integration?.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  async function handleConnect() {
    if (!botToken.trim() || !chatId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'telegram',
          credentials: { botToken: botToken.trim(), chatId: chatId.trim() },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erreur lors de la connexion')
        return
      }
      setShowForm(false)
      setBotToken('')
      setChatId('')
      router.refresh()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Déconnecter Telegram ? Tu ne recevras plus de notifications.')) return
    setLoading(true)
    try {
      await fetch('/api/integrations/telegram', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTestSending(true)
    try {
      const res = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '✅ Test ClosRM — Telegram est bien connecté !' }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erreur : ${data.error || 'Envoi échoué'}`)
      }
    } finally {
      setTestSending(false)
    }
  }

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${isConnected ? 'rgba(34,158,217,0.3)' : '#262626'}`,
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
            background: 'rgba(34,158,217,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
            ✈️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              Telegram
            </div>
            <div style={{ fontSize: 12, color: '#555' }}>
              {isConnected
                ? `Connecté depuis le ${connectedAt}`
                : 'Notifications coach en temps réel'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isConnected ? (
            <>
              <button
                onClick={handleTest}
                disabled={testSending}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#229ED9',
                  background: 'rgba(34,158,217,0.1)',
                  border: '1px solid rgba(34,158,217,0.25)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  cursor: testSending ? 'not-allowed' : 'pointer',
                  opacity: testSending ? 0.6 : 1,
                }}
              >
                {testSending ? 'Envoi...' : 'Tester'}
              </button>
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
            </>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#229ED9',
                background: 'rgba(34,158,217,0.1)',
                border: '1px solid rgba(34,158,217,0.25)',
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
              Token du bot
            </label>
            <input
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
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
              Chat ID
            </label>
            <input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="123456789"
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
            <div style={{ fontWeight: 600, color: '#888', marginBottom: 4 }}>Comment obtenir le token :</div>
            <div>1. Ouvre Telegram et cherche <strong style={{ color: '#aaa' }}>@BotFather</strong></div>
            <div>2. Envoie-lui <strong style={{ color: '#aaa' }}>/newbot</strong></div>
            <div>3. Choisis un nom (ex: &quot;ClosRM Notifs&quot;) puis un username (ex: &quot;closrm_notifs_bot&quot;)</div>
            <div>4. BotFather te donne le token → copie-le ici</div>
            <div style={{ fontWeight: 600, color: '#888', marginTop: 8, marginBottom: 4 }}>Comment obtenir le Chat ID :</div>
            <div>1. Envoie un message quelconque à ton nouveau bot</div>
            <div>2. Cherche <strong style={{ color: '#aaa' }}>@userinfobot</strong> sur Telegram et envoie-lui <strong style={{ color: '#aaa' }}>/start</strong></div>
            <div>3. Il te répond avec ton ID → copie le nombre ici</div>
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
              disabled={!botToken.trim() || !chatId.trim() || loading}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: botToken.trim() && chatId.trim() ? '#000' : 'rgba(0,0,0,0.4)',
                background: botToken.trim() && chatId.trim() ? '#229ED9' : 'rgba(34,158,217,0.3)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: botToken.trim() && chatId.trim() ? 'pointer' : 'not-allowed',
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
