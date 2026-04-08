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
      <div className="px-10 py-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4">Messages</h1>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Left: conversations ── */}
      <div className="w-[320px] shrink-0 border-r border-[var(--border-primary)] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-[var(--text-primary)]">Messages</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-full hover:text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync...' : 'Synchroniser'}
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-shadow">
            <Search size={15} className="text-[var(--text-tertiary)] shrink-0" />
            <input
              placeholder="Rechercher une conversation..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        {/* Warning */}
        {syncWarning && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-[#D69E2E]/8 text-[11px] text-[#D69E2E] leading-snug">
            {syncWarning}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center py-16 px-4 gap-3">
              <p className="text-[13px] text-[var(--text-tertiary)] text-center">{error}</p>
              <button onClick={() => fetchConversations(true)} className="px-4 py-1.5 text-[12px] font-semibold text-white rounded-lg hover:opacity-90 transition-opacity" style={{ background: 'var(--color-primary)' }}>
                Réessayer
              </button>
            </div>
          ) : (
            <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
          )}
        </div>
      </div>

      {/* ── Center: thread ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selected ? (
          <>
            {/* Thread header */}
            <div className="px-6 py-3.5 border-b border-[var(--border-primary)] flex items-center gap-3.5 shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold text-white overflow-hidden shrink-0" style={{ background: 'var(--color-primary)' }}>
                {selected.participant_avatar_url
                  ? <img src={selected.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                  : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?').toUpperCase()
                }
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {selected.participant_name ?? selected.participant_username}
                </div>
                {selected.participant_username && (
                  <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">@{selected.participant_username}</div>
                )}
              </div>
              {selected.lead_id && (
                <a
                  href={`/leads/${selected.lead_id}`}
                  className="ml-auto text-[12px] font-medium shrink-0 px-4 py-1.5 rounded-full border transition-all no-underline"
                  style={{ color: 'var(--color-primary)', borderColor: 'var(--border-primary)' }}
                >
                  Voir le lead →
                </a>
              )}
            </div>
            <ConversationThread messages={messages} />
            <MessageInput onSend={handleSend} disabled={sending} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--text-tertiary)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <span className="text-[14px] text-[var(--text-tertiary)] font-medium">Sélectionnez une conversation</span>
          </div>
        )}
      </div>

      {/* ── Right: contact panel ── */}
      {selected && <ContactPanel conversation={selected} />}
    </div>
  )
}
