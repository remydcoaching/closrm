'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, ChevronUp, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Internal type — mirrors the shape returned by /api/social/posts/[id]/messages
// (no is_self on the wire; we derive it from author_id === currentUserId)
interface SlotChatMessage {
  id: string
  author_id: string
  body: string
  created_at: string
  author?: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

interface DiscussionFooterProps {
  slotId: string
  monteurName?: string
  unreadCount: number
  onMarkRead: () => void
}

function authorName(m: SlotChatMessage): string {
  return m.author?.full_name || m.author?.email || 'Utilisateur'
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DiscussionFooter({
  slotId,
  monteurName,
  unreadCount,
  onMarkRead,
}: DiscussionFooterProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [messages, setMessages] = useState<SlotChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Resolve current user once on mount (needed to detect "self" messages)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // Lazy-load: only fetch on first expand
  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/messages`)
      const json = await res.json()
      if (Array.isArray(json.data)) setMessages(json.data)
      setLoaded(true)
      if (unreadCount > 0) onMarkRead()
    } finally {
      setLoading(false)
    }
  }, [slotId, unreadCount, onMarkRead])

  useEffect(() => {
    if (open && !loaded) {
      loadMessages()
    }
  }, [open, loaded, loadMessages])

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/social/posts/${slotId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data) setMessages(prev => [...prev, json.data])
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const visibleMessages = messages.slice(-5)

  return (
    <div style={{
      borderTop: '1px solid var(--border-primary)',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      {/* Collapsed bar — always visible, click toggles */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <MessageCircle size={14} />
          <span style={{ fontWeight: 600 }}>Discussion</span>
          {monteurName && (
            <span style={{ color: 'var(--text-tertiary)' }}>· @{monteurName}</span>
          )}
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--color-primary)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 8,
            }}>
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <ChevronUp
          size={14}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {/* Expanded section */}
      {open && (
        <div style={{
          padding: '0 18px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* Messages list */}
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              padding: '8px 0',
            }}>
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              Chargement…
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              padding: '8px 0',
              fontStyle: 'italic',
            }}>
              Aucun message. Démarrez la conversation.
            </div>
          ) : (
            <div
              ref={scrollRef}
              style={{
                overflowY: 'auto',
                maxHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {visibleMessages.map(m => {
                const isSelf = currentUserId !== null && m.author_id === currentUserId
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: isSelf ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      alignItems: isSelf ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {!isSelf && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        paddingLeft: 4,
                      }}>
                        {authorName(m)}
                      </span>
                    )}
                    <div style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: isSelf ? 'var(--color-primary)' : 'var(--bg-elevated)',
                      color: isSelf ? '#fff' : 'var(--text-primary)',
                      fontSize: 12,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: isSelf ? 'none' : '1px solid var(--border-primary)',
                    }}>
                      {m.body}
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', paddingLeft: 4, paddingRight: 4 }}>
                      {fmtTime(m.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Écrire un message…"
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: 13,
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              style={{
                padding: '8px 12px',
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !draft.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="Envoyer (Entrée)"
            >
              {sending
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={13} />
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
