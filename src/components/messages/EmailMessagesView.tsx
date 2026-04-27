'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Search, Send, Mail, Plus } from 'lucide-react'
import NewEmailModal from '@/components/messages/NewEmailModal'

interface EmailConversation {
  id: string
  workspace_id: string
  participant_email: string
  participant_name: string | null
  lead_id: string | null
  subject: string | null
  last_message_text: string | null
  last_message_at: string | null
  last_message_from: 'user' | 'participant' | null
  unread_count: number
}

interface EmailMessage {
  id: string
  conversation_id: string
  sender_type: 'user' | 'participant'
  from_email: string
  from_name: string | null
  to_email: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  sent_at: string
  is_read: boolean
  ses_status?: string | null
  _optimistic?: boolean
}

const SES_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  sent: { label: '✓ Envoyé', color: '#888' },
  delivered: { label: '✓✓ Remis', color: '#5eead4' },
  opened: { label: '👁 Ouvert', color: '#93c5fd' },
  clicked: { label: '🖱 Cliqué', color: '#c4b5fd' },
  bounced: { label: '❌ Bounce', color: '#fca5a5' },
  complained: { label: '🚫 Plainte', color: '#fcd34d' },
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function EmailMessagesView() {
  const [conversations, setConversations] = useState<EmailConversation[]>([])
  const [selected, setSelected] = useState<EmailConversation | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/emails/conversations?${params}`)
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setConversations(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 15000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  const fetchMessages = useCallback(async (convo: EmailConversation) => {
    setSelected(convo)
    setMessages([])
    try {
      const res = await fetch(`/api/emails/messages?conversation_id=${convo.id}`)
      const json = await res.json()
      setMessages(json.data ?? [])
      setConversations((prev) =>
        prev.map((c) => (c.id === convo.id ? { ...c, unread_count: 0 } : c)),
      )
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      fetch(`/api/emails/messages?conversation_id=${selected.id}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.data) setMessages(j.data)
        })
        .catch(() => {})
    }, 8000)
    return () => clearInterval(interval)
  }, [selected?.id])

  const handleSend = async () => {
    if (!selected || !draft.trim() || sending) return
    setSending(true)
    const optimisticId = `optimistic-${Date.now()}`
    const textToSend = draft
    setDraft('')
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        conversation_id: selected.id,
        sender_type: 'user' as const,
        from_email: '',
        from_name: null,
        to_email: selected.participant_email,
        subject: selected.subject,
        body_text: textToSend,
        body_html: null,
        sent_at: new Date().toISOString(),
        is_read: true,
        _optimistic: true,
      },
    ])
    try {
      const res = await fetch('/api/emails/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selected.id,
          body_text: textToSend,
          body_html: textToSend.replace(/\n/g, '<br>'),
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? json.data : m)))
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selected.id
              ? { ...c, last_message_text: textToSend, last_message_at: new Date().toISOString(), last_message_from: 'user' }
              : c,
          ),
        )
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Envoi échoué')
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchConversations()
    if (selected) {
      const res = await fetch(`/api/emails/messages?conversation_id=${selected.id}`)
      const json = await res.json()
      setMessages(json.data ?? [])
    }
    setRefreshing(false)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Inbox</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowNewModal(true)}
              title="Nouveau message"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Rafraîchir"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: refreshing ? 0.5 : 1,
              }}
            >
              <RefreshCw size={14} color="var(--text-tertiary)" className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 20px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              padding: '9px 14px',
            }}
          >
            <Search size={14} color="var(--text-tertiary)" />
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
              Chargement…
            </div>
          ) : error ? (
            <div style={{ padding: 20, fontSize: 13, color: '#ef4444' }}>{error}</div>
          ) : conversations.length === 0 ? (
            <div
              style={{
                padding: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              <Mail size={32} strokeWidth={1} opacity={0.4} />
              <p style={{ fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                Aucune conversation pour l&apos;instant.
                <br />
                Les réponses à vos emails apparaîtront ici.
              </p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => fetchMessages(c)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 20px',
                  border: 'none',
                  background:
                    selected?.id === c.id ? 'var(--bg-active, rgba(229,62,62,0.08))' : 'transparent',
                  borderBottom: '1px solid var(--border-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(c.participant_name || c.participant_email)[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: c.unread_count > 0 ? 700 : 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.participant_name || c.participant_email}
                    </span>
                    {c.unread_count > 0 && (
                      <span
                        style={{
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: 10,
                          padding: '2px 7px',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.subject || '(Sans objet)'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.last_message_from === 'user' && 'Vous : '}
                    {c.last_message_text || 'Nouveau thread'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {selected ? (
          <>
            <div
              style={{
                padding: '14px 24px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {(selected.participant_name || selected.participant_email)[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selected.participant_name || selected.participant_email}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {selected.subject || '(Sans objet)'} · {selected.participant_email}
                </div>
              </div>
              {selected.lead_id && (
                <a
                  href={`/leads/${selected.lead_id}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                    padding: '6px 14px',
                    borderRadius: 16,
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  Voir le lead →
                </a>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {messages.map((m) => {
                const content = m.body_text || (m.body_html ? htmlToText(m.body_html) : '')
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender_type === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      background:
                        m.sender_type === 'user' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                      color: m.sender_type === 'user' ? '#fff' : 'var(--text-primary)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      opacity: m._optimistic ? 0.6 : 1,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {content}
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.6,
                        marginTop: 4,
                        textAlign: m.sender_type === 'user' ? 'right' : 'left',
                        display: 'flex',
                        justifyContent: m.sender_type === 'user' ? 'flex-end' : 'flex-start',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      {m.sender_type === 'user' && m.ses_status && SES_STATUS_LABELS[m.ses_status] && (
                        <span style={{ color: SES_STATUS_LABELS[m.ses_status].color, opacity: 0.9 }}>
                          {SES_STATUS_LABELS[m.ses_status].label}
                        </span>
                      )}
                      <span>
                        {new Date(m.sent_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Écrivez votre réponse… (⌘+Entrée pour envoyer)"
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
                  opacity: sending || !draft.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            <Mail size={40} strokeWidth={1} opacity={0.3} />
            <span style={{ fontSize: 14 }}>Sélectionnez une conversation</span>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewEmailModal
          onClose={() => setShowNewModal(false)}
          onSent={async (conversationId) => {
            setShowNewModal(false)
            await fetchConversations()
            // Auto-select the new conversation
            const res = await fetch(`/api/emails/conversations`)
            const json = await res.json()
            const convos: EmailConversation[] = json.data ?? []
            const target = convos.find((c) => c.id === conversationId)
            if (target) fetchMessages(target)
          }}
        />
      )}
    </div>
  )
}
