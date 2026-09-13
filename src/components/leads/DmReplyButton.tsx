'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle2 } from 'lucide-react'

interface DmReplyButtonProps {
  leadId: string
  dmConversationActiveAt: string | null
  onMarked?: () => void
}

/**
 * ClosRM ne lit pas Instagram : cette action est déclarée manuellement par
 * le setter quand le prospect répond, indépendamment de toute session DM en
 * cours. Elle annule les relances programmées devenues inutiles.
 */
export default function DmReplyButton({ leadId, dmConversationActiveAt, onMarked }: DmReplyButtonProps) {
  const [active, setActive] = useState(!!dmConversationActiveAt)
  const [loading, setLoading] = useState(false)

  if (active) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(56,161,105,0.12)',
          color: '#38A169',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <CheckCircle2 size={16} />
        Conversation en cours — relances désactivées
      </div>
    )
  }

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/dm-reply`, { method: 'POST' })
      if (res.ok) {
        setActive(true)
        onMarked?.()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <MessageCircle size={16} />
      {loading ? 'Mise à jour…' : 'Prospect a répondu'}
    </button>
  )
}
