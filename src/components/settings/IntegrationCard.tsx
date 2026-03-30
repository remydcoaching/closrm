'use client'

import { useState } from 'react'
import { Send, MessageCircle, Calendar, CreditCard, Globe } from 'lucide-react'

interface IntegrationData {
  type: string
  is_active: boolean
  connected_at: string | null
  has_credentials: boolean
}

interface Props {
  integration: IntegrationData
  onConnect: (type: string) => void
  onDisconnect: (type: string) => void
  onToggle: (type: string, active: boolean) => void
  disabled?: boolean
}

const integrationDefs: Record<string, { name: string; description: string; icon: string }> = {
  telegram: { name: 'Telegram', description: 'Recevez des notifications en temps réel sur vos nouveaux leads et appels.', icon: 'Send' },
  whatsapp: { name: 'WhatsApp Business', description: 'Envoyez des messages automatiques à vos leads et des rappels de RDV.', icon: 'MessageCircle' },
  meta: { name: 'Meta (Facebook / Instagram)', description: 'Importez vos leads depuis vos publicités et optimisez vos campagnes.', icon: 'Globe' },
  google_calendar: { name: 'Google Agenda', description: 'Synchronisez vos RDV automatiquement avec votre agenda Google.', icon: 'Calendar' },
  stripe: { name: 'Stripe', description: 'Suivez vos paiements, abonnements et impayés. (Bientôt disponible)', icon: 'CreditCard' },
}

const iconMap: Record<string, React.ReactNode> = {
  Send: <Send size={18} />,
  MessageCircle: <MessageCircle size={18} />,
  Globe: <Globe size={18} />,
  Calendar: <Calendar size={18} />,
  CreditCard: <CreditCard size={18} />,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function IntegrationCard({ integration, onConnect, onDisconnect, onToggle, disabled }: Props) {
  const [hoverConnect, setHoverConnect] = useState(false)
  const [hoverDisconnect, setHoverDisconnect] = useState(false)

  const def = integrationDefs[integration.type] || {
    name: integration.type,
    description: '',
    icon: 'Globe',
  }

  const isConnected = integration.has_credentials && integration.connected_at !== null

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 12,
      padding: 24,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'default',
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      {/* Top row: icon + name + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isConnected ? '#00C853' : 'var(--text-tertiary)',
          flexShrink: 0,
        }}>
          {iconMap[def.icon] || <Globe size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{def.name}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 6,
              background: isConnected ? 'rgba(0,200,83,0.12)' : 'var(--border-primary)',
              color: isConnected ? '#00C853' : 'var(--text-tertiary)',
            }}>
              {isConnected ? 'Connecté' : 'Non connecté'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
        {def.description}
      </p>

      {/* Connected date */}
      {isConnected && integration.connected_at && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          Connecté le {formatDate(integration.connected_at)}
        </p>
      )}

      {!isConnected && <div style={{ height: 16 }} />}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isConnected ? (
          <button
            onClick={() => onConnect(integration.type)}
            onMouseEnter={() => setHoverConnect(true)}
            onMouseLeave={() => setHoverConnect(false)}
            style={{
              background: hoverConnect ? '#00b84a' : '#00C853',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Connecter
          </button>
        ) : (
          <>
            {/* Toggle active/inactive */}
            <button
              onClick={() => onToggle(integration.type, !integration.is_active)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                color: integration.is_active ? '#00C853' : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: integration.is_active ? 'rgba(0,200,83,0.3)' : 'var(--border-primary)',
                position: 'relative',
                transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: integration.is_active ? '#00C853' : 'var(--text-muted)',
                  position: 'absolute',
                  top: 2,
                  left: integration.is_active ? 16 : 2,
                  transition: 'all 0.2s',
                }} />
              </div>
              {integration.is_active ? 'Actif' : 'Inactif'}
            </button>

            {/* Disconnect */}
            <button
              onClick={() => onDisconnect(integration.type)}
              onMouseEnter={() => setHoverDisconnect(true)}
              onMouseLeave={() => setHoverDisconnect(false)}
              style={{
                background: hoverDisconnect ? 'rgba(229,62,62,0.1)' : 'transparent',
                border: '1px solid rgba(229,62,62,0.4)',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                color: '#E53E3E',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Déconnecter
            </button>
          </>
        )}
      </div>
    </div>
  )
}
