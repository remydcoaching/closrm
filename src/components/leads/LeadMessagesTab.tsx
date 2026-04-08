'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink, MessageCircle } from 'lucide-react'
import { IgConversation, IgMessage } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

interface LeadMessagesTabProps {
  leadId: string
  instagramHandle: string | null
}

export default function LeadMessagesTab({ leadId, instagramHandle }: LeadMessagesTabProps) {
  const [conversation, setConversation] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<IgMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchConversation() {
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

        // Fetch messages for this conversation
        const msgRes = await fetch(`/api/instagram/messages?conversation_id=${conv.id}`)
        if (msgRes.ok) {
          const msgJson = await msgRes.json()
          setMessages(msgJson.data ?? [])
        }
      } catch {
        setError('Erreur lors du chargement.')
      } finally {
        setLoading(false)
      }
    }

    fetchConversation()
  }, [leadId])

  useEffect(() => {
    // Scroll to bottom when messages load
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
        <Loader2 size={20} color="#555" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <MessageCircle size={32} color="var(--text-muted)" />
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Aucune conversation Instagram liee
        </p>
        {instagramHandle && (
          <p style={{ fontSize: 12, color: 'var(--text-label)' }}>
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                {conversation.participant_name}
              </p>
            )}
          </div>
        </div>
        <Link href="/messages" style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
          color: 'var(--text-muted)', textDecoration: 'none',
        }}>
          Ouvrir dans Messages <ExternalLink size={12} />
        </Link>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxHeight: 400,
      }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-label)', textAlign: 'center', padding: '20px 0' }}>
            Aucun message dans cette conversation.
          </p>
        ) : (
          messages.map(msg => {
            const isCoach = msg.sender_type === 'user'
            return (
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isCoach ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                alignSelf: isCoach ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 12,
                  background: isCoach ? '#E53E3E' : 'var(--bg-elevated)',
                  border: isCoach ? 'none' : '1px solid var(--border-primary)',
                  color: isCoach ? '#fff' : 'var(--text-primary)',
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  {msg.text}
                  {msg.media_url && (
                    <div style={{ marginTop: 6 }}>
                      {msg.media_type === 'image' ? (
                        <img src={msg.media_url} alt="" style={{ maxWidth: 200, borderRadius: 8 }} />
                      ) : msg.media_type === 'video' ? (
                        <video src={msg.media_url} controls style={{ maxWidth: 200, borderRadius: 8 }} />
                      ) : null}
                    </div>
                  )}
                </div>
                <p style={{
                  fontSize: 10, color: 'var(--text-label)', marginTop: 3,
                  paddingLeft: isCoach ? 0 : 4,
                  paddingRight: isCoach ? 4 : 0,
                }}>
                  {format(new Date(msg.sent_at), "d MMM yyyy 'a' HH'h'mm", { locale: fr })}
                </p>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
