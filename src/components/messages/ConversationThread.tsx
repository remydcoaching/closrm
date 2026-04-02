'use client'

import { useEffect, useRef } from 'react'
import type { IgMessage } from '@/types'

interface Props { messages: IgMessage[] }

export default function ConversationThread({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  if (messages.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Aucun message</div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map(msg => {
        const isUser = msg.sender_type === 'user'
        return (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            {msg.media_url && (
              <div style={{ marginBottom: 4, maxWidth: 220 }}>
                {msg.media_type === 'video' ? (
                  <video src={msg.media_url} controls style={{ width: '100%', borderRadius: 12 }} />
                ) : (
                  <img src={msg.media_url} alt="" style={{ width: '100%', borderRadius: 12 }} />
                )}
              </div>
            )}
            {msg.text && (
              <div style={{
                padding: '8px 14px', borderRadius: 16, maxWidth: 320, fontSize: 13, lineHeight: 1.4,
                background: isUser ? 'var(--color-primary)' : 'var(--bg-elevated)',
                color: isUser ? '#fff' : 'var(--text-primary)',
              }}>
                {msg.text}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
              {new Date(msg.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
