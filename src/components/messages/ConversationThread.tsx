'use client'

import { useEffect, useRef } from 'react'
import type { IgMessage } from '@/types'

interface Props { messages: (IgMessage & { _optimistic?: boolean })[] }

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1)
  const b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(dateStr: string): boolean {
  return isSameDay(dateStr, new Date().toISOString())
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
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
    <div className="flex-1 flex items-center justify-center">
      <span className="text-sm text-[#3a3a3a]">Aucun message</span>
    </div>
  )

  return (
    <div
      className="flex-1 py-6 flex flex-col gap-[3px]"
      style={{ overflowY: 'auto', overflowX: 'hidden', paddingLeft: 24, paddingRight: 24 }}
    >
      {messages.map((msg, idx) => {
        const isUser = msg.sender_type === 'user'
        const isOptimistic = msg._optimistic
        const prevMsg = idx > 0 ? messages[idx - 1] : null
        const showDateSep = !prevMsg || !isSameDay(prevMsg.sent_at, msg.sent_at)

        // Group consecutive messages from same sender — only show time on last
        const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null
        const isLastInGroup = !nextMsg || nextMsg.sender_type !== msg.sender_type || !isSameDay(nextMsg.sent_at, msg.sent_at)

        return (
          <div key={msg.id}>
            {showDateSep && (
              <div className="flex justify-center my-5">
                <span
                  className="text-[10px] font-medium tracking-wide"
                  style={{
                    color: '#555',
                    background: '#141414',
                    border: '1px solid #1e1e1e',
                    borderRadius: 20,
                    padding: '5px 16px',
                  }}
                >
                  {formatDateSeparator(msg.sent_at)}
                </span>
              </div>
            )}

            {/* Message row */}
            <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                {/* Media */}
                {msg.media_url && (
                  <div style={{ marginBottom: 4, maxWidth: 220 }}>
                    {msg.media_type === 'video' ? (
                      <video src={msg.media_url} controls style={{ width: '100%', borderRadius: 16 }} />
                    ) : msg.media_type === 'audio' ? (
                      <audio src={msg.media_url} controls style={{ width: '100%', height: 40 }} />
                    ) : (
                      <img src={msg.media_url} alt="" style={{ width: '100%', borderRadius: 16, maxWidth: msg.media_type === 'sticker' ? 100 : undefined }} />
                    )}
                  </div>
                )}

                {/* Bubble */}
                {msg.text && (
                  <div
                    style={{
                      padding: '10px 16px',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      overflowWrap: 'anywhere' as const,
                      wordBreak: 'break-word' as const,
                      opacity: isOptimistic ? 0.55 : 1,
                      ...(isUser
                        ? {
                            background: 'linear-gradient(135deg, #E53E3E, #C53030)',
                            color: '#fff',
                            borderRadius: '20px 20px 6px 20px',
                            boxShadow: '0 2px 10px rgba(229,62,62,0.18)',
                          }
                        : {
                            background: '#161616',
                            border: '1px solid #1e1e1e',
                            color: '#e0e0e0',
                            borderRadius: '20px 20px 20px 6px',
                          }),
                    }}
                  >
                    {msg.text}
                  </div>
                )}

                {/* Timestamp — only on last message in group */}
                {isLastInGroup && (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#4a4a4a',
                      marginTop: 4,
                      paddingLeft: 4,
                      paddingRight: 4,
                      fontStyle: isOptimistic ? 'italic' : undefined,
                    }}
                  >
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
