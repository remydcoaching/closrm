// Messages > Email — web EmailMessagesView + NewEmailModal. Routes:
// GET/POST /api/emails/conversations (15 s refresh), GET/POST /api/emails/messages
// (8 s refresh of the open thread), GET /api/leads?search (recipient picker).
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api-client'
import { Avatar } from '../../../design-system/Avatar'
import { Button } from '../../../design-system/Button'
import { Input, Textarea } from '../../../design-system/Input'
import { SearchInput } from '../../../design-system/SearchInput'
import { Tabs } from '../../../design-system/Tabs'
import { EmptyState, LoadingState } from '../../../design-system/States'
import type { LeadsListResponse } from '../../leads/types'
import { errorMessage } from '../http'
import { htmlToText, shortAgo } from '../format'
import type { EmailConversation, EmailMessage } from '../types'
import { MessageThread } from './MessageThread'

const SES_STATUS: Record<string, string> = {
  sent: '✓ Envoyé',
  delivered: '✓✓ Remis',
  opened: 'Ouvert',
  clicked: 'Cliqué',
  bounced: 'Bounce',
  complained: 'Plainte',
}

const toHtml = (text: string) => text.replace(/\n/g, '<br>')

export function EmailInbox() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<EmailConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<EmailConversation | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchConversations = useCallback(async (): Promise<EmailConversation[]> => {
    try {
      const p = new URLSearchParams()
      if (debounced) p.set('search', debounced)
      const r = await api.get<{ data: EmailConversation[] }>(`/api/emails/conversations?${p.toString()}`)
      setConversations(r.data ?? [])
      setError(null)
      return r.data ?? []
    } catch (err) {
      setError(errorMessage(err))
      return []
    } finally {
      setLoading(false)
    }
  }, [debounced])

  useEffect(() => {
    fetchConversations()
    const id = setInterval(fetchConversations, 15000)
    return () => clearInterval(id)
  }, [fetchConversations])

  const loadMessages = useCallback(async (c: EmailConversation) => {
    const r = await api.get<{ data: EmailMessage[] }>(`/api/emails/messages?conversation_id=${c.id}`)
    return r.data ?? []
  }, [])

  async function select(c: EmailConversation) {
    setSelected(c)
    setMessages([])
    try {
      setMessages(await loadMessages(c))
      setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)))
    } catch {
      /* silent, like the web */
    }
  }

  useEffect(() => {
    if (!selected) return
    const id = setInterval(() => {
      loadMessages(selected)
        .then((data) => setMessages((prev) => [...data, ...prev.filter((m) => m._optimistic)]))
        .catch(() => undefined)
    }, 8000)
    return () => clearInterval(id)
  }, [selected, loadMessages])

  async function send() {
    if (!selected || !draft.trim() || sending) return
    setSending(true)
    const text = draft
    const optimisticId = `optimistic-${Date.now()}`
    setDraft('')
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        conversation_id: selected.id,
        sender_type: 'user',
        from_email: '',
        from_name: null,
        to_email: selected.participant_email,
        subject: selected.subject,
        body_text: text,
        body_html: null,
        sent_at: new Date().toISOString(),
        is_read: true,
        _optimistic: true,
      },
    ])
    try {
      const r = await api.post<{ data: EmailMessage }>('/api/emails/messages', {
        conversation_id: selected.id,
        body_text: text,
        body_html: toHtml(text),
      })
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? r.data : m)))
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString(), last_message_from: 'user' } : c,
        ),
      )
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setDraft(text)
      setError(errorMessage(err) || 'Envoi échoué')
    } finally {
      setSending(false)
    }
  }

  const label = (c: EmailConversation) => c.participant_name || c.participant_email

  return (
    <div className="mk-inbox">
      <div className="mk-inbox-list">
        <div className="mk-inbox-list-head">
          <div className="mk-toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher…" />
            <button className="mk-action mk-action--primary" onClick={() => setShowNew(true)}>
              + Nouveau
            </button>
          </div>
          {error && (
            <div className="mk-banner mk-banner--warning">
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="mk-inbox-scroll">
          {loading ? (
            <LoadingState label="Chargement…" />
          ) : conversations.length === 0 ? (
            <EmptyState title="Aucune conversation pour l'instant" description="Les réponses à vos emails apparaîtront ici." />
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`mk-convo ${selected?.id === c.id ? 'mk-convo--active' : ''} ${c.unread_count > 0 ? 'mk-convo--unread' : ''}`}
                onClick={() => select(c)}
              >
                <Avatar name={label(c)} size={40} />
                <div className="mk-convo-body">
                  <div className="mk-convo-top">
                    <span className="mk-convo-name">{label(c)}</span>
                    {c.unread_count > 0 ? (
                      <span className="mk-unread-count">{c.unread_count}</span>
                    ) : (
                      <span className="mk-convo-time">{shortAgo(c.last_message_at)}</span>
                    )}
                  </div>
                  <div className="mk-convo-preview">{c.subject || '(Sans objet)'}</div>
                  <div className="mk-convo-preview">
                    {c.last_message_from === 'user' && 'Vous : '}
                    {c.last_message_text || 'Nouveau thread'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mk-thread">
        {selected ? (
          <>
            <div className="mk-thread-head">
              <Avatar name={label(selected)} size={40} />
              <div className="mk-thread-head-text">
                <div className="mk-name">{label(selected)}</div>
                <div className="ds-muted">
                  {selected.subject || '(Sans objet)'} · {selected.participant_email}
                </div>
              </div>
              {selected.lead_id && (
                <button className="mk-action" onClick={() => navigate(`/leads/${selected.lead_id}`)}>
                  Voir le lead →
                </button>
              )}
            </div>
            <MessageThread
              items={messages.map((m) => ({
                id: m.id,
                mine: m.sender_type === 'user',
                text: m.body_text || (m.body_html ? htmlToText(m.body_html) : ''),
                sentAt: m.sent_at,
                pending: !!m._optimistic,
                status: m.sender_type === 'user' && m.ses_status ? (SES_STATUS[m.ses_status] ?? null) : null,
              }))}
            />
            <div className="mk-composer">
              <div className="mk-composer-row">
                <Textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrivez votre réponse… (⌘+Entrée pour envoyer)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      send()
                    }
                  }}
                />
                <Button variant="primary" disabled={sending || !draft.trim()} onClick={send}>
                  {sending ? '…' : 'Envoyer'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="mk-thread-empty">Sélectionnez une conversation</div>
        )}
      </div>

      {showNew && (
        <NewEmailModal
          onClose={() => setShowNew(false)}
          onSent={async (conversationId) => {
            setShowNew(false)
            const list = await fetchConversations()
            const target = list.find((c) => c.id === conversationId)
            if (target) select(target)
          }}
        />
      )}
    </div>
  )
}

type LeadOption = LeadsListResponse['data'][number]

function NewEmailModal({ onClose, onSent }: { onClose: () => void; onSent: (conversationId: string) => void }) {
  const [mode, setMode] = useState<'lead' | 'email'>('lead')
  const [leadSearch, setLeadSearch] = useState('')
  const [results, setResults] = useState<LeadOption[]>([])
  const [lead, setLead] = useState<LeadOption | null>(null)
  const [freeEmail, setFreeEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'lead' || !leadSearch.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api
        .get<LeadsListResponse>(`/api/leads?search=${encodeURIComponent(leadSearch)}&per_page=10`)
        .then((r) => setResults((r.data ?? []).filter((l) => l.email).slice(0, 10)))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [leadSearch, mode])

  const recipientOk = mode === 'lead' ? !!lead : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(freeEmail.trim())
  const canSend = recipientOk && subject.trim().length > 0 && body.trim().length > 0

  async function send() {
    if (!canSend || sending) return
    setSending(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { subject: subject.trim(), body_text: body, body_html: toHtml(body) }
      if (mode === 'lead' && lead) {
        payload.lead_id = lead.id
        payload.to_email = lead.email
        payload.to_name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null
      } else {
        payload.to_email = freeEmail.trim()
      }
      const r = await api.post<{ data?: { conversation_id?: string; id?: string }; conversation_id?: string }>('/api/emails/conversations', payload)
      onSent(r.conversation_id ?? r.data?.conversation_id ?? r.data?.id ?? '')
    } catch (err) {
      setError(errorMessage(err))
      setSending(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nouveau message</h2>
        <div className="mk-form">
          <Tabs
            items={[
              { key: 'lead' as const, label: 'Un lead' },
              { key: 'email' as const, label: 'Adresse libre' },
            ]}
            active={mode}
            onChange={setMode}
          />
          {mode === 'lead' ? (
            lead ? (
              <div className="mk-banner">
                <span>
                  {`${lead.first_name} ${lead.last_name}`.trim()} · {lead.email}
                </span>
                <button className="mk-action" onClick={() => setLead(null)}>
                  Changer
                </button>
              </div>
            ) : (
              <>
                <SearchInput value={leadSearch} onChange={setLeadSearch} placeholder="Rechercher un lead avec email…" />
                {results.length > 0 && (
                  <div className="mk-lead-list">
                    {results.map((l) => (
                      <button key={l.id} className="mk-lead-option" onClick={() => setLead(l)}>
                        <span className="mk-name">{`${l.first_name} ${l.last_name}`.trim() || '—'}</span> <span className="ds-muted">{l.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          ) : (
            <Input type="email" placeholder="destinataire@exemple.fr" value={freeEmail} onChange={(e) => setFreeEmail(e.target.value)} />
          )}
          <Input placeholder="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea rows={6} placeholder="Votre message…" value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button variant="primary" disabled={!canSend || sending} onClick={send}>
              {sending ? 'Envoi…' : 'Envoyer'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
