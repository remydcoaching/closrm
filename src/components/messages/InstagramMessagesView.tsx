'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Search, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import ContactPanel from '@/components/messages/ContactPanel'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function InstagramMessagesView() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<(IgMessage & { _optimistic?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(true)
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialSyncDone = useRef(false)
  const hasLoadedOnce = useRef(false)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  const fetchConversations = useCallback(async (withSync = false) => {
    if (!hasLoadedOnce.current) setLoading(true)
    setError(null)
    try {
      const accRes = await fetch('/api/instagram/account')
      const accJson = await accRes.json()
      if (!accJson.data) { setHasAccount(false); setLoading(false); return }
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (withSync) params.set('sync', 'true')
      const res = await fetch(`/api/instagram/conversations?${params}`)
      if (!res.ok) throw new Error('Erreur lors du chargement')
      const json = await res.json()
      setConversations(json.data ?? [])
      setSyncWarning(json.syncWarning ?? null)
      hasLoadedOnce.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true
      fetchConversations(false).then(() => {
        fetch('/api/instagram/conversations?sync=true').catch(() => {})
      })
    } else {
      fetchConversations(false)
    }
  }, [fetchConversations])

  const handleSync = async () => {
    setSyncing(true)
    await fetchConversations(true)
    setSyncing(false)
  }

  const fetchMessages = useCallback(async (convo: IgConversation) => {
    setSelected(convo)
    try {
      const res = await fetch(`/api/instagram/messages?conversation_id=${convo.id}`)
      const json = await res.json()
      setMessages(json.data ?? [])
    } catch { setMessages([]) }
  }, [])

  const handleSend = async (text: string) => {
    if (!selected || sending) return
    setSending(true)
    const optimisticId = `optimistic-${Date.now()}`
    setMessages(prev => [...prev, {
      id: optimisticId, workspace_id: '', conversation_id: selected.id,
      sender_type: 'user' as const, text, sent_at: new Date().toISOString(),
      media_url: null, media_type: null, ig_message_id: null, is_read: true, _optimistic: true,
    }])
    try {
      const res = await fetch('/api/instagram/messages/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selected.id, text }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => prev.map(m => m.id === optimisticId ? json.data : m))
        setConversations(prev => prev.map(c =>
          c.id === selected.id ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() } : c
        ))
      } else { setMessages(prev => prev.filter(m => m.id !== optimisticId)) }
    } catch { setMessages(prev => prev.filter(m => m.id !== optimisticId)) }
    finally { setSending(false) }
  }

  const handleSendImage = async (file: File) => {
    if (!selected) return
    const formData = new FormData()
    formData.append('conversation_id', selected.id)
    formData.append('image', file)
    try {
      const res = await fetch('/api/instagram/messages/send-image', { method: 'POST', body: formData })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => [...prev, json.data])
        setConversations(prev => prev.map(c =>
          c.id === selected.id ? { ...c, last_message_text: '📷 Photo', last_message_at: new Date().toISOString() } : c
        ))
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      fetch(`/api/instagram/messages?conversation_id=${selected.id}&refresh=true`)
        .then(r => r.json()).then(j => { if (j.data) setMessages(j.data) }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [selected?.id])

  useEffect(() => {
    if (!hasAccount) return
    const interval = setInterval(() => fetchConversations(false), 15000)
    return () => clearInterval(interval)
  }, [hasAccount, fetchConversations])

  if (!hasAccount) {
    return (
      <div style={{ padding: '40px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Messages</h1>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left column ── */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Messages</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Synchroniser les conversations"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              opacity: syncing ? 0.5 : 1,
            }}
          >
            <RefreshCw size={15} color="var(--text-tertiary)" className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 14, padding: '11px 16px',
          }}>
            <Search size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Warning */}
        {syncWarning && (
          <div style={{ margin: '0 24px 12px', padding: '8px 14px', borderRadius: 10, background: 'rgba(214,158,46,0.06)', fontSize: 12, color: '#D69E2E', lineHeight: 1.4 }}>
            {syncWarning}
          </div>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>{error}</p>
              <button
                onClick={() => fetchConversations(true)}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                Réessayer
              </button>
            </div>
          ) : (
            <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
          )}
        </div>
      </div>

      {/* ── Center column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Thread header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: selected.participant_avatar_url ? 'transparent' : 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {selected.participant_avatar_url
                  ? <img src={selected.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?').toUpperCase()
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selected.participant_name ?? selected.participant_username}
                </div>
                {selected.participant_username && (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>@{selected.participant_username}</div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {selected.lead_id && (
                  <a
                    href={`/leads/${selected.lead_id}`}
                    style={{
                      fontSize: 13, fontWeight: 500,
                      color: 'var(--color-primary)', textDecoration: 'none',
                      padding: '7px 18px', borderRadius: 20,
                      border: '1px solid var(--border-primary)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Voir le lead →
                  </a>
                )}
                <button
                  onClick={() => setShowPanel(p => !p)}
                  title={showPanel ? 'Masquer le panel' : 'Infos contact'}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid var(--border-primary)',
                    background: showPanel ? 'var(--bg-active)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {showPanel
                    ? <PanelRightClose size={16} color="var(--color-primary)" />
                    : <PanelRightOpen size={16} color="var(--text-tertiary)" />
                  }
                </button>
              </div>
            </div>

            <ConversationThread messages={messages} />
            <MessageInput onSend={handleSend} onSendImage={handleSendImage} disabled={sending} />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth={1} style={{ opacity: 0.4 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <span style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 500 }}>Sélectionnez une conversation</span>
          </div>
        )}
      </div>

      {/* ── Right column (togglable) ── */}
      {selected && showPanel && <ContactPanel conversation={selected} />}
    </div>
  )
}
