'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
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

  // Debounce search input by 300ms
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const hasLoadedOnce = useRef(false)
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
      if (!res.ok) throw new Error('Erreur lors du chargement des conversations')
      const json = await res.json()
      setConversations(json.data ?? [])
      setSyncWarning(json.syncWarning ?? null)
      hasLoadedOnce.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true
      // Load cache first (fast), then sync Meta in background
      fetchConversations(false).then(() => {
        // Background sync — don't block UI
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
    } catch {
      setMessages([])
    }
  }, [])

  const handleSend = async (text: string) => {
    if (!selected || sending) return
    setSending(true)

    // Optimistic message
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg = {
      id: optimisticId,
      workspace_id: '',
      conversation_id: selected.id,
      sender_type: 'user' as const,
      text,
      sent_at: new Date().toISOString(),
      media_url: null,
      media_type: null,
      ig_message_id: null,
      is_read: true,
      _optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/instagram/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selected.id, text }),
      })
      if (res.ok) {
        const json = await res.json()
        setMessages(prev => prev.map(m => m.id === optimisticId ? json.data : m))
        setConversations(prev => prev.map(c =>
          c.id === selected.id
            ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() }
            : c
        ))
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  // Poll active conversation messages every 5s with refresh=true (triggers Meta API fetch)
  useEffect(() => {
    if (!selected) return
    const interval = setInterval(() => {
      fetch(`/api/instagram/messages?conversation_id=${selected.id}&refresh=true`)
        .then(res => res.json())
        .then(json => { if (json.data) setMessages(json.data) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [selected?.id])

  // Poll conversation list every 15s
  useEffect(() => {
    if (!hasAccount) return
    const interval = setInterval(() => {
      fetchConversations(false)
    }, 15000)
    return () => clearInterval(interval)
  }, [hasAccount, fetchConversations])

  if (!hasAccount) {
    return (
      <div className="px-10 py-8 max-w-[1400px]">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] mb-1.5">Messages</h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-6">Conversations Instagram</p>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div className="px-10 py-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Messages</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-[#888] bg-[#161616] border border-[#222] rounded-[10px] hover:bg-[#1a1a1a] hover:border-[#333] hover:text-[#aaa] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Synchronisation...' : 'Synchroniser'}
        </button>
      </div>
      <p className="text-[13px] text-[var(--text-tertiary)] mb-4">Conversations Instagram</p>

      {/* Sync warning banner */}
      {syncWarning && (
        <div className="mb-4 px-4 py-3 rounded-[10px] bg-[#D69E2E]/10 border border-[#D69E2E]/20 text-[13px] text-[#D69E2E] flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <span className="font-medium">Sync impossible : </span>
            {syncWarning}
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex h-[calc(100vh-200px)] bg-[#0A0A0A] border border-[#1f1f1f] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">

        {/* Left column — conversation list (300px) */}
        <div className="w-[300px] shrink-0 border-r border-[#1a1a1a] bg-[#0d0d0d] flex flex-col">
          <div className="p-3">
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#161616] border border-[#222] rounded-[10px] text-[12px] text-[var(--text-primary)] placeholder:text-[#555] outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-[13px] text-[var(--text-tertiary)] text-center">{error}</p>
                <button
                  onClick={() => fetchConversations(true)}
                  className="px-4 py-1.5 text-[12px] font-medium bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
            )}
          </div>
        </div>

        {/* Center column — thread + input */}
        <div className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg, #E53E3E, #C53030)' }}
                >
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?').toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-white truncate">
                    {selected.participant_name ?? selected.participant_username}
                  </div>
                  {selected.participant_username && (
                    <div className="text-[10px] text-[#555]">@{selected.participant_username}</div>
                  )}
                </div>
                {selected.lead_id && (
                  <a
                    href={`/leads/${selected.lead_id}`}
                    className="ml-auto text-[12px] text-[#E53E3E] hover:text-[#C53030] hover:underline transition-colors shrink-0"
                  >
                    Voir le lead &rarr;
                  </a>
                )}
              </div>
              <ConversationThread messages={messages} />
              <MessageInput onSend={handleSend} disabled={sending} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <svg className="w-12 h-12 text-[#444] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <p className="text-[13px] text-[#444]">Sélectionnez une conversation</p>
            </div>
          )}
        </div>

        {/* Right column — contact panel (280px), only when a conversation is selected */}
        {selected && (
          <ContactPanel conversation={selected} />
        )}
      </div>
    </div>
  )
}
