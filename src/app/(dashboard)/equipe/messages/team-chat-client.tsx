'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Hash, User } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  user_id: string
  role: string
  user: { id: string; email: string; full_name: string; avatar_url: string | null }
}

interface TeamMessage {
  id: string
  workspace_id: string
  sender_id: string
  recipient_id: string | null
  lead_id: string | null
  content: string
  is_read: boolean
  created_at: string
  sender: { id: string; full_name: string; avatar_url: string | null }
}

type Channel = { type: 'general' } | { type: 'private'; userId: string; userName: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function channelKey(ch: Channel): string {
  return ch.type === 'general' ? 'general' : `private-${ch.userId}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TeamChatClient() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel>({ type: 'general' })
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch current user id ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch('/api/user/profile')
        const json = await res.json()
        if (json.data?.user?.id) setCurrentUserId(json.data.user.id)
      } catch { /* silent */ }
    }
    fetchMe()
  }, [])

  // ── Fetch team members ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/workspaces/members')
        const json = await res.json()
        setMembers(json.data ?? [])
      } catch { /* silent */ }
    }
    fetchMembers()
  }, [])

  // ── Fetch messages for current channel ─────────────────────────────────
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (channel.type === 'general') {
        params.set('channel', 'general')
      } else {
        params.set('channel', 'private')
        params.set('with_user_id', channel.userId)
      }
      params.set('limit', '100')

      const res = await fetch(`/api/team-messages?${params}`)
      const json = await res.json()
      if (json.data) setMessages(json.data)
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false) }
  }, [channel])

  useEffect(() => {
    fetchMessages(false)
  }, [fetchMessages])

  // ── Polling every 10s ──────────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(true), 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchMessages])

  // ── Auto-scroll to bottom ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ───────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const body: Record<string, string> = { content: trimmed }
      if (channel.type === 'private') body.recipient_id = channel.userId

      const res = await fetch('/api/team-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const json = await res.json()
        setMessages(prev => [...prev, json.data])
        setText('')
        textareaRef.current?.focus()
      }
    } catch { /* silent */ }
    finally { setSending(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Derive other members (exclude self) ────────────────────────────────
  const otherMembers = members.filter(m => m.user_id !== currentUserId)

  // ── Channel header label ───────────────────────────────────────────────
  const channelLabel = channel.type === 'general'
    ? '# Général'
    : channel.userName

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Left sidebar: channels + members ── */}
      <div style={{
        width: 250, flexShrink: 0,
        borderRight: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-secondary)',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Chat équipe
          </h1>
        </div>

        {/* Channel list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* General channel */}
          <ChannelItem
            icon={<Hash size={15} />}
            label="Général"
            active={channel.type === 'general'}
            onClick={() => setChannel({ type: 'general' })}
          />

          {/* Separator */}
          <div style={{
            height: 1, background: 'var(--border-primary)',
            margin: '12px 10px',
          }} />

          {/* Label */}
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-label)',
            padding: '0 10px', marginBottom: 8,
            letterSpacing: '0.2em', textTransform: 'uppercase' as const,
          }}>
            Messages privés
          </div>

          {/* Members for DMs */}
          {otherMembers.map(m => (
            <ChannelItem
              key={m.user_id}
              icon={
                m.user.avatar_url
                  ? <img src={m.user.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                  : <User size={14} />
              }
              label={m.user.full_name || m.user.email}
              subtitle={m.role}
              active={channel.type === 'private' && channel.userId === m.user_id}
              onClick={() => setChannel({ type: 'private', userId: m.user_id, userName: m.user.full_name || m.user.email })}
            />
          ))}

          {otherMembers.length === 0 && (
            <div style={{ padding: '16px 10px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              Aucun autre membre
            </div>
          )}
        </div>
      </div>

      {/* ── Right: conversation ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Conversation header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          {channel.type === 'general'
            ? <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Hash size={18} color="var(--text-tertiary)" />
              </div>
            : <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#fff',
              }}>
                {getInitials(channel.userName)}
              </div>
          }
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {channelLabel}
            </div>
            {channel.type === 'general' && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                Visible par toute l&apos;équipe
              </div>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }} key={channelKey(channel)}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Chargement...</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Hash size={28} color="var(--text-tertiary)" style={{ opacity: 0.4 }} />
              </div>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                Aucun message pour le moment
              </span>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUserId
                const showDateSep = i === 0 || formatDateSeparator(msg.created_at) !== formatDateSeparator(messages[i - 1].created_at)

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDateSep && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        margin: '20px 0 12px',
                      }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' as const }}>
                          {formatDateSeparator(msg.created_at)}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                      </div>
                    )}

                    {/* Message bubble */}
                    <div style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                      gap: 8,
                      alignItems: 'flex-end',
                    }}>
                      {/* Sender avatar (left for others) */}
                      {!isMe && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--bg-elevated)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                          flexShrink: 0,
                        }}>
                          {msg.sender.avatar_url
                            ? <img src={msg.sender.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : getInitials(msg.sender.full_name)
                          }
                        </div>
                      )}

                      <div style={{ maxWidth: '65%' }}>
                        {/* Sender name (for others only) */}
                        {!isMe && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3, paddingLeft: 2 }}>
                            {msg.sender.full_name}
                          </div>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: 16,
                          background: isMe ? 'var(--color-primary)' : 'var(--bg-elevated)',
                          color: isMe ? '#fff' : 'var(--text-primary)',
                          fontSize: 14,
                          lineHeight: 1.45,
                          wordBreak: 'break-word' as const,
                          whiteSpace: 'pre-wrap' as const,
                        }}>
                          {msg.content}
                        </div>

                        {/* Time */}
                        <div style={{
                          fontSize: 10, color: 'var(--text-tertiary)',
                          marginTop: 3,
                          textAlign: isMe ? 'right' : 'left',
                          paddingLeft: isMe ? 0 : 2,
                          paddingRight: isMe ? 2 : 0,
                        }}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div style={{ borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <div style={{ padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'flex-end',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 24, padding: '4px 6px 4px 20px',
            }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Votre message..."
                rows={1}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 14, fontFamily: 'inherit',
                  background: 'transparent', color: 'var(--text-primary)',
                  border: 'none', outline: 'none', resize: 'none',
                  lineHeight: 1.4, maxHeight: 120, overflow: 'auto',
                }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                cursor: text.trim() && !sending ? 'pointer' : 'default',
                opacity: sending ? 0.5 : 1,
                background: text.trim() && !sending ? 'var(--color-primary)' : 'var(--bg-elevated)',
                transition: 'all 0.2s',
              }}
            >
              <Send size={18} color={text.trim() && !sending ? '#fff' : 'var(--text-tertiary)'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ChannelItem sub-component ──────────────────────────────────────────────

function ChannelItem({
  icon,
  label,
  subtitle,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  subtitle?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 10px',
        borderRadius: 8, border: 'none',
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--text-tertiary)',
        cursor: 'pointer', fontSize: 13,
        textAlign: 'left', fontFamily: 'inherit',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-tertiary)'
        }
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>
        {icon}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
        {label}
      </span>
      {subtitle && (
        <span style={{ fontSize: 10, color: 'var(--text-label)', textTransform: 'capitalize' as const }}>
          {subtitle}
        </span>
      )}
    </button>
  )
}
