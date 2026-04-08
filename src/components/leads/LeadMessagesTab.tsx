'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink, MessageCircle } from 'lucide-react'
import type { IgConversation, IgMessage } from '@/types'
import Link from 'next/link'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'

interface LeadMessagesTabProps {
  leadId: string
  instagramHandle: string | null
}

export default function LeadMessagesTab({ leadId, instagramHandle }: LeadMessagesTabProps) {
  const [conversation, setConversation] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<(IgMessage & { _optimistic?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchMessages(convId: string, silent = false) {
    const url = silent
      ? `/api/instagram/messages?conversation_id=${convId}&refresh=true`
      : `/api/instagram/messages?conversation_id=${convId}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setMessages(json.data ?? [])
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/instagram/conversations?lead_id=${leadId}`)
        if (!res.ok) {
          setError('Erreur lors du chargement des conversations.')
          return
        }
        const json = await res.json()
        const convs: IgConversation[] = json.data ?? []
        if (convs.length === 0) {
          setConversation(null)
          return
        }
        const conv = convs[0]
        setConversation(conv)
        await fetchMessages(conv.id)
      } catch {
        setError('Erreur lors du chargement.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [leadId])

  // Polling every 5s for new messages
  useEffect(() => {
    if (!conversation) return
    pollingRef.current = setInterval(() => {
      fetchMessages(conversation.id, true)
    }, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [conversation?.id])

  async function handleSend(text: string) {
    if (!conversation) return
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: IgMessage & { _optimistic: boolean } = {
      id: optimisticId,
      workspace_id: '',
      conversation_id: conversation.id,
      ig_message_id: null,
      sender_type: 'user',
      text,
      media_url: null,
      media_type: null,
      sent_at: new Date().toISOString(),
      is_read: false,
      _optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])
    try {
      await fetch('/api/instagram/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversation.id, text }),
      })
      await fetchMessages(conversation.id, true)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    }
  }

  async function handleSendImage(file: File) {
    if (!conversation) return
    const optimisticId = `optimistic-img-${Date.now()}`
    const previewUrl = URL.createObjectURL(file)
    const optimisticMsg: IgMessage & { _optimistic: boolean } = {
      id: optimisticId,
      workspace_id: '',
      conversation_id: conversation.id,
      ig_message_id: null,
      sender_type: 'user',
      text: '',
      media_url: previewUrl,
      media_type: 'image',
      sent_at: new Date().toISOString(),
      is_read: false,
      _optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])
    try {
      const formData = new FormData()
      formData.append('conversation_id', conversation.id)
      formData.append('image', file)
      await fetch('/api/instagram/messages/send-image', {
        method: 'POST',
        body: formData,
      })
      await fetchMessages(conversation.id, true)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      URL.revokeObjectURL(previewUrl)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
        <Loader2 size={20} color="var(--text-tertiary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--color-primary)' }}>{error}</p>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <MessageCircle size={32} color="var(--text-tertiary)" />
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Aucune conversation Instagram liee
        </p>
        {instagramHandle && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Le pseudo @{instagramHandle} n&apos;a pas encore de conversation associee.
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {conversation.participant_avatar_url ? (
            <img
              src={conversation.participant_avatar_url}
              alt=""
              style={{ width: 28, height: 28, borderRadius: '50%' }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 12, fontWeight: 700,
            }}>
              {(conversation.participant_username ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              @{conversation.participant_username ?? 'inconnu'}
            </p>
            {conversation.participant_name && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                {conversation.participant_name}
              </p>
            )}
          </div>
        </div>
        <Link href="/messages" style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          color: 'var(--text-tertiary)', textDecoration: 'none',
        }}>
          Ouvrir dans Messages <ExternalLink size={12} />
        </Link>
      </div>

      {/* Thread */}
      <ConversationThread messages={messages} />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onSendImage={handleSendImage}
      />
    </div>
  )
}
