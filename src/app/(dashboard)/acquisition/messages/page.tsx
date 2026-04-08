'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import ContactPanel from '@/components/messages/ContactPanel'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function MessagesPage() {
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

  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      fetch(`/api/instagram/messages?conversation_id=${selected.id}&refresh=true`)
        .then(res => res.json()).then(json => { if (json.data) setMessages(json.data) }).catch(() => {})
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Messages</h1>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Left column: conversations ── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Messages</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              color: '#666', background: '#111', border: '1px solid #1e1e1e',
              borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s',
              opacity: syncing ? 0.5 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#999' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#666' }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync...' : 'Synchroniser'}
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 20px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#111', border: '1px solid #1a1a1a', borderRadius: 12,
            padding: '10px 14px', transition: 'border-color 0.2s',
          }}>
            <Search size={15} color="#3a3a3a" />
            <input
              placeholder="Rechercher une conversation..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 13, color: '#ccc', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Sync warning */}
        {syncWarning && (
          <div style={{ padding: '0 20px 8px' }}>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(214,158,46,0.06)', fontSize: 11, color: '#D69E2E', lineHeight: 1.4 }}>
              {syncWarning}
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 12 }}>
              <p style={{ fontSize: 13, color: '#444', textAlign: 'center' }}>{error}</p>
              <button
                onClick={() => fetchConversations(true)}
                style={{ padding: '8px 20px', fontSize: 12, fontWeight: 600, background: '#E53E3E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Réessayer
              </button>
            </div>
          ) : (
            <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
          )}
        </div>
      </div>

      {/* ── Center column: thread ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Thread header */}
            <div style={{
              padding: '14px 24px',
              borderBottom: '1px solid #1a1a1a',
              display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #E53E3E, #C53030)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, color: '#fff',
                flexShrink: 0, overflow: 'hidden',
              }}>
                {selected.participant_avatar_url
                  ? <img src={selected.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?').toUpperCase()
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                  {selected.participant_name ?? selected.participant_username}
                </div>
                {selected.participant_username && (
                  <div style={{ fontSize: 12, color: '#444', marginTop: 1 }}>@{selected.participant_username}</div>
                )}
              </div>
              {selected.lead_id && (
                <a
                  href={`/leads/${selected.lead_id}`}
                  style={{
                    marginLeft: 'auto', fontSize: 12, color: '#E53E3E',
                    textDecoration: 'none', fontWeight: 500, flexShrink: 0,
                    padding: '6px 16px', borderRadius: 20,
                    border: '1px solid rgba(229,62,62,0.2)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  Voir le lead →
                </a>
              )}
            </div>

            <ConversationThread messages={messages} />
            <MessageInput onSend={handleSend} disabled={sending} />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <span style={{ fontSize: 14, color: '#2a2a2a', fontWeight: 500 }}>Sélectionnez une conversation</span>
          </div>
        )}
      </div>

      {/* ── Right column: contact panel ── */}
      {selected && <ContactPanel conversation={selected} />}
    </div>
  )
}
