'use client'

import { useState, useEffect, useCallback } from 'react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<IgMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [hasAccount, setHasAccount] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      let accRes = await fetch('/api/instagram/account')
      let accJson = await accRes.json()
      if (!accJson.data) {
        // Try to create ig_account from existing Meta integration
        accRes = await fetch('/api/instagram/account', { method: 'POST' })
        accJson = await accRes.json()
        if (!accJson.data) { setHasAccount(false); setLoading(false); return }
      }

      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/instagram/conversations?${params}`)
      const json = await res.json()
      setConversations(json.data ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const fetchMessages = useCallback(async (convo: IgConversation) => {
    setSelected(convo)
    const res = await fetch(`/api/instagram/messages?conversation_id=${convo.id}`)
    const json = await res.json()
    setMessages(json.data ?? [])
  }, [])

  const handleSend = async (text: string) => {
    if (!selected) return
    const res = await fetch('/api/instagram/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: selected.id, text }),
    })
    if (res.ok) {
      const json = await res.json()
      setMessages(prev => [...prev, json.data])
      setConversations(prev => prev.map(c =>
        c.id === selected.id
          ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() }
          : c
      ))
    }
  }

  if (!hasAccount) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Messages</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>Conversations Instagram</p>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Messages</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>Conversations Instagram</p>

      <div style={{
        display: 'flex', height: 'calc(100vh - 200px)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ width: 350, borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12 }}>
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 13,
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--bg-elevated)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden',
                }}>
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?')
                  }
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selected.participant_name ?? selected.participant_username}
                  </div>
                  {selected.participant_username && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{selected.participant_username}</div>
                  )}
                </div>
                {selected.lead_id && (
                  <a href={`/leads/${selected.lead_id}`} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none' }}>
                    Voir la fiche lead →
                  </a>
                )}
              </div>
              <ConversationThread messages={messages} />
              <MessageInput onSend={handleSend} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
