'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  type: string
  onClose: () => void
  onConnect: (type: string, credentials: Record<string, string>) => void
}

const integrationNames: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp Business',
  meta: 'Meta (Facebook / Instagram)',
  google_calendar: 'Google Agenda',
  stripe: 'Stripe',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  display: 'block',
}

export default function ConnectIntegrationModal({ open, type, onClose, onConnect }: Props) {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [hoverConnect, setHoverConnect] = useState(false)

  if (!open) return null

  function updateField(key: string, value: string) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      await onConnect(type, fields)
    } finally {
      setLoading(false)
      setFields({})
    }
  }

  function renderFields() {
    if (type === 'telegram') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Token du bot</label>
            <input
              style={inputStyle}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={fields.bot_token || ''}
              onChange={e => updateField('bot_token', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Chat ID</label>
            <input
              style={inputStyle}
              placeholder="123456789"
              value={fields.chat_id || ''}
              onChange={e => updateField('chat_id', e.target.value)}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Créez un bot via @BotFather sur Telegram, puis envoyez /start au bot pour obtenir votre Chat ID.
          </p>
        </>
      )
    }

    if (type === 'whatsapp') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Phone Number ID</label>
            <input
              style={inputStyle}
              placeholder="1234567890"
              value={fields.phone_number_id || ''}
              onChange={e => updateField('phone_number_id', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Access Token</label>
            <input
              style={inputStyle}
              placeholder="EAAxxxxxxx..."
              value={fields.access_token || ''}
              onChange={e => updateField('access_token', e.target.value)}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Rendez-vous sur developers.facebook.com &gt; WhatsApp &gt; API Setup pour obtenir ces informations.
          </p>
        </>
      )
    }

    if (type === 'meta') {
      return (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Configuration OAuth — sera disponible prochainement.
        </p>
      )
    }

    if (type === 'google_calendar') {
      return (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
            Connectez votre Google Agenda pour synchroniser vos rendez-vous directement depuis le CRM.
          </p>
          <a
            href="/api/integrations/google/authorize"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-primary)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Connecter Google Agenda
          </a>
        </>
      )
    }

    if (type === 'stripe') {
      return (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Bientôt disponible.
        </p>
      )
    }

    return null
  }

  const canSubmit = type === 'telegram'
    ? !!(fields.bot_token && fields.chat_id)
    : type === 'whatsapp'
    ? !!(fields.phone_number_id && fields.access_token)
    : false

  const isDisabledType = type === 'meta' || type === 'stripe' || type === 'google_calendar'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 16,
        maxWidth: 480,
        width: '90%',
        padding: 24,
        boxShadow: '0 24px 64px var(--shadow-dropdown)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Connecter {integrationNames[type] || type}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ marginBottom: 24 }}>
          {renderFields()}
        </div>

        {/* Footer */}
        {!isDisabledType && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              onMouseEnter={() => setHoverConnect(true)}
              onMouseLeave={() => setHoverConnect(false)}
              style={{
                background: canSubmit ? (hoverConnect ? '#00b84a' : 'var(--color-primary)') : 'rgba(0,200,83,0.3)',
                color: canSubmit ? '#000' : 'rgba(0,0,0,0.4)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1,
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Connexion...' : 'Connecter'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
