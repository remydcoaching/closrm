// Messages > Instagram — web InstagramMessagesView + ConversationList +
// ConversationThread + MessageInput + ContactPanel. Same routes and polling:
// GET /api/instagram/account, GET /api/instagram/conversations?search&sync,
// GET /api/instagram/messages?conversation_id[&refresh=true] (5 s),
// conversations refresh every 15 s, POST /api/instagram/messages/send,
// POST /api/instagram/messages/send-image (multipart), GET/PATCH /api/leads/:id.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api-client'
import { openWeb } from '../../../lib/web-link'
import { Avatar } from '../../../design-system/Avatar'
import { Button } from '../../../design-system/Button'
import { Textarea } from '../../../design-system/Input'
import { SearchInput } from '../../../design-system/SearchInput'
import { StatusPill } from '../../../design-system/StatusPill'
import { EmptyState, LoadingState } from '../../../design-system/States'
import { statusEntry, callTypeLabel } from '../../leads/status'
import type { LeadWithRelations } from '../../leads/types'
import { apiPostForm, errorMessage } from '../http'
import { shortAgo } from '../format'
import type { IgConversation, IgMessage } from '../types'
import { MessageThread } from './MessageThread'

export function InstagramInbox() {
  const navigate = useNavigate()
  const [hasAccount, setHasAccount] = useState<boolean | null>(null)
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<IgMessage[]>([])
  const [showPanel, setShowPanel] = useState(true)
  const initialSync = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchConversations = useCallback(
    async (withSync = false) => {
      setError(null)
      try {
        const acc = await api.get<{ data: unknown }>('/api/instagram/account')
        if (!acc.data) {
          setHasAccount(false)
          return
        }
        setHasAccount(true)
        const p = new URLSearchParams()
        if (debounced) p.set('search', debounced)
        if (withSync) p.set('sync', 'true')
        const r = await api.get<{ data: IgConversation[]; syncWarning?: string }>(`/api/instagram/conversations?${p.toString()}`)
        setConversations(r.data ?? [])
        setSyncWarning(r.syncWarning ?? null)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [debounced],
  )

  useEffect(() => {
    fetchConversations(false).then(() => {
      // Web behaviour: background Meta sync after the first paint.
      if (!initialSync.current) {
        initialSync.current = true
        api.get('/api/instagram/conversations?sync=true').catch(() => undefined)
      }
    })
  }, [fetchConversations])

  useEffect(() => {
    if (!hasAccount) return
    const id = setInterval(() => fetchConversations(false), 15000)
    return () => clearInterval(id)
  }, [hasAccount, fetchConversations])

  async function select(c: IgConversation) {
    setSelected(c)
    setMessages([])
    try {
      const r = await api.get<{ data: IgMessage[] }>(`/api/instagram/messages?conversation_id=${c.id}`)
      setMessages(r.data ?? [])
      setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)))
    } catch {
      setMessages([])
    }
  }

  useEffect(() => {
    if (!selected) return
    const id = setInterval(() => {
      api
        .get<{ data: IgMessage[] }>(`/api/instagram/messages?conversation_id=${selected.id}&refresh=true`)
        .then((r) => {
          if (r.data) setMessages((prev) => [...r.data, ...prev.filter((m) => m._optimistic)])
        })
        .catch(() => undefined)
    }, 5000)
    return () => clearInterval(id)
  }, [selected])

  async function sync() {
    setSyncing(true)
    await fetchConversations(true)
    setSyncing(false)
  }

  async function sendText(text: string): Promise<boolean> {
    if (!selected) return false
    const optimisticId = `optimistic-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        conversation_id: selected.id,
        sender_type: 'user',
        text,
        sent_at: new Date().toISOString(),
        media_url: null,
        media_type: null,
        is_read: true,
        _optimistic: true,
      },
    ])
    try {
      const r = await api.post<{ data: IgMessage }>('/api/instagram/messages/send', { conversation_id: selected.id, text })
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? r.data : m)))
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() } : c)),
      )
      return true
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setError(errorMessage(err))
      return false
    }
  }

  async function sendImage(file: File): Promise<boolean> {
    if (!selected) return false
    const form = new FormData()
    form.append('conversation_id', selected.id)
    form.append('image', file)
    try {
      const r = await apiPostForm<{ data: IgMessage }>('/api/instagram/messages/send-image', form)
      setMessages((prev) => [...prev, r.data])
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, last_message_text: '📷 Photo', last_message_at: new Date().toISOString() } : c)),
      )
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  if (hasAccount === false) {
    return (
      <div className="mk-card">
        <EmptyState title="Instagram n'est pas connecté" description="Connectez votre compte Instagram pour retrouver vos DMs ici." />
        <div className="mk-toolbar" style={{ justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => openWeb('/parametres/integrations')}>
            Connecter Instagram ↗
          </Button>
        </div>
      </div>
    )
  }

  const name = (c: IgConversation) => c.participant_name ?? c.participant_username ?? 'Inconnu'

  return (
    <div className="mk-inbox">
      <div className="mk-inbox-list">
        <div className="mk-inbox-list-head">
          <div className="mk-toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher…" />
            <button className="mk-action" disabled={syncing} onClick={sync} title="Synchroniser les conversations">
              {syncing ? 'Sync…' : '↻ Sync'}
            </button>
          </div>
          {syncWarning && <div className="mk-banner mk-banner--warning">{syncWarning}</div>}
          {error && (
            <div className="mk-banner mk-banner--warning">
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="mk-inbox-scroll">
          {loading ? (
            <LoadingState label="Chargement des conversations…" />
          ) : conversations.length === 0 ? (
            <EmptyState title="Aucune conversation" />
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`mk-convo ${selected?.id === c.id ? 'mk-convo--active' : ''} ${c.unread_count > 0 ? 'mk-convo--unread' : ''}`}
                onClick={() => select(c)}
              >
                <Avatar name={name(c)} src={c.participant_avatar_url} size={28} />
                <div className="mk-convo-body">
                  <div className="mk-convo-top">
                    <span className="mk-convo-name">{name(c)}</span>
                    <span className="mk-convo-time">{shortAgo(c.last_message_at)}</span>
                  </div>
                  <div className="mk-convo-preview">{c.last_message_text ?? ''}</div>
                </div>
                {c.unread_count > 0 && <span className="mk-unread-dot" />}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mk-thread">
        {selected ? (
          <>
            <div className="mk-thread-head">
              <Avatar name={name(selected)} src={selected.participant_avatar_url} size={28} />
              <div className="mk-thread-head-text">
                <div className="mk-name">{name(selected)}</div>
                {selected.participant_username && <div className="ds-muted">@{selected.participant_username}</div>}
              </div>
              {selected.lead_id && (
                <button className="mk-action" onClick={() => navigate(`/leads/${selected.lead_id}`)}>
                  Voir le lead →
                </button>
              )}
              <button className="mk-action" onClick={() => setShowPanel((p) => !p)}>
                {showPanel ? 'Masquer infos' : 'Infos contact'}
              </button>
            </div>
            <MessageThread
              items={messages.map((m) => ({
                id: m.id,
                mine: m.sender_type === 'user',
                text: m.text,
                sentAt: m.sent_at,
                pending: !!m._optimistic,
                mediaUrl: m.media_url,
                mediaType: m.media_type,
              }))}
            />
            <IgComposer onSend={sendText} onSendImage={sendImage} />
          </>
        ) : (
          <div className="mk-thread-empty">Sélectionnez une conversation</div>
        )}
      </div>

      {selected && showPanel && <ContactPanel conversation={selected} />}
    </div>
  )
}

function IgComposer({ onSend, onSendImage }: { onSend: (t: string) => Promise<boolean>; onSendImage: (f: File) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url)
  }, [image])

  async function send() {
    if (busy) return
    if (image) {
      setBusy(true)
      const ok = await onSendImage(image.file)
      if (ok) setImage(null)
      setBusy(false)
      return
    }
    const t = text.trim()
    if (!t) return
    setBusy(true)
    setText('')
    const ok = await onSend(t)
    if (!ok) setText(t)
    setBusy(false)
  }

  return (
    <div className="mk-composer">
      {image && (
        <div className="mk-composer-preview">
          <img src={image.url} alt="Aperçu" />
          <button className="mk-action" onClick={() => setImage(null)}>
            ×
          </button>
        </div>
      )}
      <div className="mk-composer-row">
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Votre message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="mk-action" title="Envoyer une photo" onClick={() => fileRef.current?.click()}>
          Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setImage({ file: f, url: URL.createObjectURL(f) })
            e.target.value = ''
          }}
        />
        <Button variant="primary" disabled={busy || (!text.trim() && !image)} onClick={send}>
          {busy ? '…' : 'Envoyer'}
        </Button>
      </div>
    </div>
  )
}

function ContactPanel({ conversation }: { conversation: IgConversation }) {
  const navigate = useNavigate()
  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLead(null)
    setFailed(false)
    setNotes('')
    if (!conversation.lead_id) return
    setLoading(true)
    api
      .get<{ data: LeadWithRelations }>(`/api/leads/${conversation.lead_id}`)
      .then((r) => {
        setLead(r.data)
        setNotes(r.data.notes ?? '')
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [conversation.lead_id])

  async function saveNotes() {
    if (!lead || notes === (lead.notes ?? '')) return
    setSaving(true)
    try {
      await api.patch(`/api/leads/${lead.id}`, { notes })
      setLead({ ...lead, notes })
    } finally {
      setSaving(false)
    }
  }

  const name = conversation.participant_name ?? conversation.participant_username ?? 'Inconnu'
  // Web: first pending call, ascending by date.
  const nextCall = lead
    ? [...lead.calls].filter((c) => c.outcome === 'pending').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null
    : null

  return (
    <aside className="mk-contact">
      <div className="mk-contact-head">
        <Avatar name={name} src={conversation.participant_avatar_url} size={56} />
        <div className="mk-name">{name}</div>
        {conversation.participant_username && <div className="ds-muted">@{conversation.participant_username}</div>}
      </div>
      {!conversation.lead_id ? (
        <p className="ds-muted">Aucun lead associé</p>
      ) : loading ? (
        <LoadingState />
      ) : failed || !lead ? (
        <p className="ds-muted">Impossible de charger le lead</p>
      ) : (
        <>
          <span className="mk-label">Statut pipeline</span>
          <div>
            <StatusPill {...statusEntry(lead.status)} />
          </div>
          <span className="mk-label">Tags</span>
          {lead.tags.length === 0 ? (
            <span className="ds-muted">Aucun tag</span>
          ) : (
            <div className="mk-tags">
              {lead.tags.map((t) => (
                <span key={t} className="mk-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          <span className="mk-label">Prochain RDV</span>
          {nextCall ? (
            <div>
              <div className="mk-name">{callTypeLabel(nextCall.type)}</div>
              <div className="ds-muted">
                {new Date(nextCall.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                {new Date(nextCall.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ) : (
            <span className="ds-muted">Aucun planifié</span>
          )}
          <button className="mk-action" onClick={() => navigate(`/leads/${lead.id}`)}>
            Fiche complète →
          </button>
          <span className="mk-label">Notes {saving && '· Sauvegarde…'}</span>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Ajouter une note…" />
        </>
      )}
    </aside>
  )
}
