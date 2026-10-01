// Équipe › Chat — port of equipe/messages/team-chat-client.tsx.
// Channels: Général + one private channel per teammate. Polling every 10 s
// like the web. Endpoints: GET /api/team-messages?channel=general|private
// (&with_user_id), POST /api/team-messages { content, recipient_id? },
// GET /api/workspaces/members, GET /api/auth/me.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { swrGet } from '../../lib/query-cache'
import { Avatar } from '../../design-system/Avatar'
import { Textarea } from '../../design-system/Input'
import { EmptyState, LoadingState } from '../../design-system/States'
import { errMsg } from '../social/http'
import '../social/social.css'

interface TeamMember {
  id: string
  user_id: string
  role: string
  user: { id: string; email: string; full_name: string | null; avatar_url: string | null }
}
interface TeamMessage {
  id: string
  sender_id: string
  recipient_id: string | null
  content: string
  created_at: string
  sender: { id: string; full_name: string | null; avatar_url: string | null } | null
}
type Channel = { type: 'general' } | { type: 'private'; userId: string; userName: string }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', setter: 'Setter', closer: 'Closer', monteur: 'Monteur' }

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yest.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function TeamChatPage() {
  const [me, setMe] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [channel, setChannel] = useState<Channel>({ type: 'general' })
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get<{ data: { userId: string } }>('/api/auth/me')
      .then((r) => setMe(r.data.userId))
      .catch(() => {})
    api
      .get<{ data: TeamMember[] }>('/api/workspaces/members')
      .then((r) => setMembers(r.data ?? []))
      .catch(() => {})
  }, [])

  const fetchMessages = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true)
      try {
        const p = new URLSearchParams({ limit: '100' })
        if (channel.type === 'general') p.set('channel', 'general')
        else {
          p.set('channel', 'private')
          p.set('with_user_id', channel.userId)
        }
        // The last known messages of this channel show at once.
        await swrGet<{ data?: TeamMessage[] }>(`/api/team-messages?${p.toString()}`, (r) => {
          if (r.data) setMessages(r.data)
          if (!silent) setLoading(false)
        })
        setError(null)
      } catch (e) {
        if (!silent) setError(errMsg(e))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [channel],
  )

  useEffect(() => {
    void fetchMessages(false)
    const t = setInterval(() => void fetchMessages(true), 10_000)
    return () => clearInterval(t)
  }, [fetchMessages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const body: Record<string, string> = { content }
      if (channel.type === 'private') body.recipient_id = channel.userId
      const r = await api.post<{ data: TeamMessage }>('/api/team-messages', body)
      setMessages((prev) => [...prev, r.data])
      setText('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSending(false)
    }
  }

  const others = members.filter((m) => m.user_id !== me)
  const label = channel.type === 'general' ? '# Général' : channel.userName

  return (
    <div className="soc-page" style={{ overflow: 'hidden' }}>
      <header className="soc-header">
        <div>
          <h1>Chat équipe</h1>
          <p>Canal général + messages privés entre membres du workspace.</p>
        </div>
      </header>
      <div className="soc-chat">
        <aside className="soc-chat-side">
          <span className="soc-label" style={{ padding: '6px 10px' }}>Canaux</span>
          <button type="button" className={`soc-chat-channel ${channel.type === 'general' ? 'soc-chat-channel--active' : ''}`} onClick={() => setChannel({ type: 'general' })}>
            # Général
          </button>
          <span className="soc-label" style={{ padding: '10px 10px 6px' }}>Messages privés</span>
          {others.length === 0 && <span className="soc-muted" style={{ padding: '0 10px' }}>Aucun autre membre.</span>}
          {others.map((m) => {
            const name = m.user.full_name || m.user.email
            const active = channel.type === 'private' && channel.userId === m.user_id
            return (
              <button
                key={m.user_id}
                type="button"
                className={`soc-chat-channel ${active ? 'soc-chat-channel--active' : ''}`}
                onClick={() => setChannel({ type: 'private', userId: m.user_id, userName: name })}
              >
                <Avatar name={name} size={24} src={m.user.avatar_url} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span className="ds-muted" style={{ fontSize: 10 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
              </button>
            )
          })}
        </aside>
        <div className="soc-chat-main">
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>
            {label}
            {channel.type === 'general' && <span className="soc-muted" style={{ fontWeight: 400 }}> · visible par toute l'équipe</span>}
          </div>
          <div className="soc-chat-messages">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <p className="soc-error">{error}</p>
            ) : messages.length === 0 ? (
              <EmptyState title="Aucun message" description="Envoyez le premier message." />
            ) : (
              messages.map((m, i) => {
                const self = m.sender_id === me
                const name = m.sender?.full_name || 'Membre'
                const showDay = i === 0 || new Date(messages[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString()
                return (
                  <div key={m.id}>
                    {showDay && <div className="soc-chat-sep">{dayLabel(m.created_at)}</div>}
                    <div className={`soc-chat-msg ${self ? 'soc-chat-msg--self' : ''}`}>
                      <Avatar name={name} size={28} src={m.sender?.avatar_url} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: self ? 'flex-end' : 'flex-start' }}>
                        <div className="soc-chat-meta">
                          {self ? 'Vous' : name} · {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="soc-chat-bubble">{m.content}</div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={endRef} />
          </div>
          <div className="soc-chat-compose">
            <Textarea
              rows={2}
              value={text}
              placeholder={`Message ${label}…`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={sending || !text.trim()} onClick={() => void send()}>
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
