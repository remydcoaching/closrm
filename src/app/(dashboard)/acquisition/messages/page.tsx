'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ConversationList from '@/components/messages/ConversationList'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import IgNotConnected from '@/components/social/instagram/IgNotConnected'
import type { IgConversation, IgMessage } from '@/types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [selected, setSelected] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<(IgMessage & { _optimistic?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccount, setHasAccount] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sending, setSending] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let accRes = await fetch('/api/instagram/account')
      let accJson = await accRes.json()
      if (!accJson.data) {
        accRes = await fetch('/api/instagram/account', { method: 'POST' })
        accJson = await accRes.json()
        if (!accJson.data) { setHasAccount(false); setLoading(false); return }
      }

      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/instagram/conversations?${params}`)
      if (!res.ok) throw new Error('Erreur lors du chargement des conversations')
      const json = await res.json()
      setConversations(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { fetchConversations() }, [fetchConversations])

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
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === optimisticId ? json.data : m))
        setConversations(prev => prev.map(c =>
          c.id === selected.id
            ? { ...c, last_message_text: text, last_message_at: new Date().toISOString() }
            : c
        ))
      } else {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }

  if (!hasAccount) {
    return (
      <div className="px-10 py-8 max-w-[1200px]">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] mb-1.5">Messages</h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-6">Conversations Instagram</p>
        <IgNotConnected />
      </div>
    )
  }

  return (
    <div className="px-10 py-8 max-w-[1200px]">
      <h1 className="text-[22px] font-bold text-[var(--text-primary)] mb-1.5">Messages</h1>
      <p className="text-[13px] text-[var(--text-tertiary)] mb-6">Conversations Instagram</p>

      <div className="flex h-[calc(100vh-200px)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
        {/* Conversation list sidebar */}
        <div className="w-[350px] border-r border-[var(--border-primary)] flex flex-col">
          <div className="p-3">
            <input
              placeholder="Rechercher..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow"
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
                  onClick={fetchConversations}
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

        {/* Thread panel */}
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-semibold text-[var(--text-primary)] overflow-hidden shrink-0">
                  {selected.participant_avatar_url
                    ? <img src={selected.participant_avatar_url} alt="" className="w-full h-full object-cover" />
                    : (selected.participant_name?.[0] ?? selected.participant_username?.[0] ?? '?')
                  }
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {selected.participant_name ?? selected.participant_username}
                  </div>
                  {selected.participant_username && (
                    <div className="text-[11px] text-[var(--text-tertiary)]">@{selected.participant_username}</div>
                  )}
                </div>
                {selected.lead_id && (
                  <a href={`/leads/${selected.lead_id}`} className="ml-auto text-xs text-[var(--color-primary)] hover:underline transition-colors">
                    Voir la fiche lead &rarr;
                  </a>
                )}
              </div>
              <ConversationThread messages={messages} />
              <MessageInput onSend={handleSend} disabled={sending} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-tertiary)]">
              <svg className="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <p className="text-[13px]">Selectionnez une conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
