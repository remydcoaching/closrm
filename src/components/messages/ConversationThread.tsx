'use client'

import { useEffect, useRef } from 'react'
import type { IgMessage } from '@/types'

interface Props { messages: (IgMessage & { _optimistic?: boolean })[] }

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(dateStr: string): boolean { return isSameDay(dateStr, new Date().toISOString()) }

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const y = new Date(); y.setDate(y.getDate() - 1)
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
}

function formatDateSeparator(dateStr: string): string {
  if (isToday(dateStr)) return "Aujourd'hui"
  if (isYesterday(dateStr)) return 'Hier'
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function ConversationThread({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevLengthRef.current || prevLengthRef.current === 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length === 0 ? 0 : messages[0]?.id])

  if (messages.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Aucun message</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {messages.map((msg, idx) => {
        const isUser = msg.sender_type === 'user'
        const isOptimistic = msg._optimistic
        const prevMsg = idx > 0 ? messages[idx - 1] : null
        const showDateSep = !prevMsg || !isSameDay(prevMsg.sent_at, msg.sent_at)
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null
        const isLastInGroup = !nextMsg || nextMsg.sender_type !== msg.sender_type || !isSameDay(nextMsg.sent_at, msg.sent_at)

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, letterSpacing: 0.3,
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 20, padding: '6px 18px',
                }}>
                  {formatDateSeparator(msg.sent_at)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', width: '100%', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '65%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>

                {/* Media */}
                {msg.media_url && (
                  <div style={{ marginBottom: 4, maxWidth: 240 }}>
                    {msg.media_type === 'video' ? (
                      <video src={msg.media_url} controls style={{ width: '100%', borderRadius: 16 }} />
                    ) : msg.media_type === 'audio' ? (
                      <audio src={msg.media_url} controls style={{ width: '100%', height: 40 }} />
                    ) : (
                      <img src={msg.media_url} alt="" style={{
                        width: '100%', borderRadius: 16,
                        maxWidth: msg.media_type === 'sticker' ? 100 : undefined,
                      }} />
                    )}
                  </div>
                )}

                {/* Bubble */}
                {msg.text && (
                  <div style={{
                    padding: '10px 16px',
                    fontSize: 14,
                    lineHeight: 1.55,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    opacity: isOptimistic ? 0.55 : 1,
                    ...(isUser
                      ? {
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: '20px 20px 6px 20px',
                        }
                      : {
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)',
                          borderRadius: '20px 20px 20px 6px',
                        }),
                  }}>
                    {msg.text}
                  </div>
                )}

                {/* Timestamp */}
                {isLastInGroup && (
                  <span style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    marginTop: 4, padding: '0 4px',
                    fontStyle: isOptimistic ? 'italic' : undefined,
                  }}>
                    {isOptimistic ? 'Envoi...' : formatTime(msg.sent_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
