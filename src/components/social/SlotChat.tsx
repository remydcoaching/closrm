'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

interface Props {
  slotId: string
  /** Si fourni, evite un round-trip auth. Sinon le composant fetch supabase.auth.getUser(). */
  currentUserId?: string
  /** Polling interval en ms pour rafraichir les messages. 0 = jamais. Default 15000 (15s). */
  pollMs?: number
  /** Si true, le composant prend toute la hauteur disponible (au lieu de maxHeight 360). */
  fillHeight?: boolean
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function authorInitials(m: SlotChatMessage): string {
  const name = m.author?.full_name || m.author?.email || '?'
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function authorName(m: SlotChatMessage): string {
  return m.author?.full_name || m.author?.email || 'Utilisateur'
}

export default function SlotChat({ slotId, currentUserId: propUserId, pollMs = 15000, fillHeight = false }: Props) {
  const [messages, setMessages] = useState<SlotChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId ?? null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Si pas de prop, on fetch l'utilisateur courant (pour savoir quels msg sont "miens")
  useEffect(() => {
    if (propUserId) { setCurrentUserId(propUserId); return }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [propUserId])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/posts/${slotId}/messages`)
      const json = await res.json()
      if (Array.isArray(json.data)) setMessages(json.data)
    } finally {
      setLoading(false)
    }
  }, [slotId])

  // Initial load + polling
  useEffect(() => {
    load()
    if (pollMs <= 0) return
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  // Auto-scroll au bottom quand un nouveau message arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    const body = input.trim()
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
        setInput('')
      }
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-secondary)',
      border: fillHeight ? 'none' : '1px solid var(--border-primary)',
      borderRadius: fillHeight ? 0 : 10,
      maxHeight: fillHeight ? 'none' : 360,
      flex: fillHeight ? 1 : undefined,
      minHeight: fillHeight ? 0 : undefined,
      overflow: 'hidden',
    }}>
      {/* Messages list */}
      <div ref={scrollRef} style={{
        flex: 1, overflow: 'auto', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: fillHeight ? 0 : 120,
        maxHeight: fillHeight ? 'none' : 280,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20, color: 'var(--text-tertiary)' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 12px', fontSize: 12,
            color: 'var(--text-tertiary)', fontStyle: 'italic',
          }}>
            Aucun message. Démarre la conversation.
          </div>
        ) : (
          messages.map(m => {
            const mine = m.author_id === currentUserId
            return (
              <div key={m.id} style={{
                display: 'flex', gap: 8,
                flexDirection: mine ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                {m.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.author.avatar_url}
                    alt={authorName(m)}
                    style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: mine ? 'rgba(139,92,246,0.2)' : 'var(--bg-elevated)',
                    color: mine ? '#8b5cf6' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                  }}>
                    {authorInitials(m)}
                  </div>
                )}
                {/* Bubble */}
                <div style={{
                  maxWidth: '75%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                  gap: 2,
                }}>
                  <div style={{
                    padding: '7px 10px', borderRadius: 10,
                    background: mine ? '#8b5cf6' : 'var(--bg-elevated)',
                    color: mine ? '#fff' : 'var(--text-primary)',
                    fontSize: 13, lineHeight: 1.4,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    border: mine ? 'none' : '1px solid var(--border-primary)',
                  }}>
                    {m.body}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                    {!mine && <span style={{ marginRight: 4 }}>{authorName(m)} ·</span>}
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: 8, borderTop: '1px solid var(--border-primary)',
        background: 'var(--bg-primary)',
        display: 'flex', gap: 6, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écris un message... (Entrée pour envoyer)"
          rows={1}
          style={{
            flex: 1, resize: 'none', minHeight: 32, maxHeight: 100,
            padding: '7px 10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8, fontSize: 13,
            color: 'var(--text-primary)', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={send}
          disabled={sending || input.trim().length === 0}
          style={{
            height: 32, width: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#8b5cf6', color: '#fff',
            border: 'none', borderRadius: 8,
            cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !input.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
          title="Envoyer (Entrée)"
        >
          {sending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
        </button>
      </div>
    </div>
  )
}
