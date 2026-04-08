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
    } catch {
      setMessages([])
    }
  }, [])

  const handleSend = async (text: string) => {
    if (!selected || sending) return
    setSending(true)
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg = {
      id: optimisticId, workspace_id: '', conversation_id: selected.id,
      sender_type: 'user' as const, text, sent_at: new Date().toISOString(),
      media_url: null, media_type: null, ig_message_id: null, is_read: true, _optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])
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
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  // Poll messages from Meta API every 5s
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

  // Poll conversations every 15s
  useEffect(() => {
    if (!hasAccount) return
    const interval = setInterval(() => fetchConversations(false), 15000)
    return () => clearInterval(interval)
  }, [hasAccount, fetchConversations])

  if (!hasAccount) {
    return (
      <div className="px-10 py-8">
        <h1 className="text-xl font-bold text-white mb-4">Messages</h1>
        <IgNotConnected />
      </div>
    )
  }

  // Full-bleed layout — no nested containers
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Thin top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-white">Messages</h1>
          <span className="text-[11px] text-[#444]">Instagram</span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-[#555] hover:text-[#888] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sync...' : 'Sync'}
        </button>
      </div>

      {/* Sync warning */}
      {syncWarning && (
        <div className="px-6 py-2 bg-[#D69E2E]/5 border-b border-[#D69E2E]/15 text-[11px] text-[#D69E2E] shrink-0">
          {syncWarning}
        </div>
      )}

      {/* 3-column layout — full height, no extra borders */}
      <div className="flex flex-1 min-h-0">
        {/* Left: conversations */}
        <div className="w-[280px] shrink-0 border-r border-[#1a1a1a] flex flex-col">
          <div className="px-3 py-2.5 shrink-0">
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#141414] border border-[#1e1e1e] rounded-lg text-[12px] text-white placeholder:text-[#3a3a3a] outline-none focus:border-[#2a2a2a] transition-colors"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                <p className="text-[12px] text-[#444] text-center">{error}</p>
                <button onClick={() => fetchConversations(true)} className="px-3 py-1 text-[11px] bg-[#E53E3E] text-white rounded-md hover:opacity-90">
                  Réessayer
                </button>
              </div>
            ) : (
              <ConversationList conversations={conversations} selected={selected} onSelect={fetchMessages} loading={loading} />
            )}
          </div>
        </div>

        {/* Center: thread */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selected ? (
            <>
              {/* Compact header */}
              <div className="px-5 py-2.5 border-b border-[#1a1a1a] flex items-center gap-3 shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg, #E53E3E, #C53030)' }}
                >
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?').toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-white">{selected.participant_name ?? selected.participant_username}</span>
                  {selected.participant_username && (
                    <span className="text-[10px] text-[#444] ml-2">@{selected.participant_username}</span>
                  )}
                </div>
                {selected.lead_id && (
                  <a href={`/leads/${selected.lead_id}`} className="ml-auto text-[11px] text-[#E53E3E] hover:text-[#ff5555] transition-colors shrink-0">
                    Fiche lead &rarr;
                  </a>
                )}
              </div>
              <ConversationThread messages={messages} />
              <MessageInput onSend={handleSend} disabled={sending} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <svg className="w-10 h-10 text-[#222]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <p className="text-[12px] text-[#333]">Sélectionnez une conversation</p>
            </div>
          )}
        </div>

        {/* Right: contact panel */}
        {selected && <ContactPanel conversation={selected} />}
      </div>
    </div>
  )
}
