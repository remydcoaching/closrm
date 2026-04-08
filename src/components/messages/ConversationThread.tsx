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
    <div className="flex-1 flex items-center justify-center">
      <span className="text-[14px] text-[var(--text-tertiary)]">Aucun message</span>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-[3px]" style={{ overflowX: 'hidden' }}>
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
              <div className="flex justify-center my-5">
                <span className="text-[10px] font-medium tracking-wide text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-full px-4 py-1.5">
                  {formatDateSeparator(msg.sent_at)}
                </span>
              </div>
            )}

            <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                {msg.media_url && (
                  <div className="mb-1 max-w-[220px]">
                    {msg.media_type === 'video' ? (
                      <video src={msg.media_url} controls className="w-full rounded-2xl" />
                    ) : msg.media_type === 'audio' ? (
                      <audio src={msg.media_url} controls className="w-full h-10" />
                    ) : (
                      <img src={msg.media_url} alt="" className={`w-full rounded-2xl ${msg.media_type === 'sticker' ? 'max-w-[100px]' : ''}`} />
                    )}
                  </div>
                )}

                {msg.text && (
                  <div
                    className={isOptimistic ? 'opacity-55' : ''}
                    style={{
                      padding: '10px 16px',
                      fontSize: 14,
                      lineHeight: 1.5,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
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
                    }}
                  >
                    {msg.text}
                  </div>
                )}

                {isLastInGroup && (
                  <span className={`text-[10px] text-[var(--text-tertiary)] mt-1 px-1.5 ${isOptimistic ? 'italic' : ''}`}>
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
