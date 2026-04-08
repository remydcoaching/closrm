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

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function renderMedia(msg: IgMessage) {
  if (!msg.media_url) return null
  const type = msg.media_type?.toLowerCase()

  if (type === 'video') {
    return (
      <div className="mb-1 max-w-[220px]">
        <video src={msg.media_url} controls className="w-full rounded-2xl" />
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="mb-1 max-w-[260px]">
        <audio src={msg.media_url} controls className="w-full h-10" />
      </div>
    )
  }

  // image, sticker, or fallback
  return (
    <div className="mb-1 max-w-[220px]">
      <img
        src={msg.media_url}
        alt=""
        className={`w-full rounded-2xl ${type === 'sticker' ? 'max-w-[120px]' : ''}`}
      />
    </div>
  )
}

export default function ConversationThread({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  // Only auto-scroll when new messages arrive (not on every render)
  useEffect(() => {
    if (messages.length > prevLengthRef.current || prevLengthRef.current === 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  // Also scroll when conversation changes (messages reset)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages.length === 0 ? 0 : messages[0]?.id])

  if (messages.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-[#444] text-[13px]">
      Aucun message
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 flex flex-col gap-2.5">
      {messages.map((msg, idx) => {
        const isUser = msg.sender_type === 'user'
        const isOptimistic = msg._optimistic
        const prevMsg = idx > 0 ? messages[idx - 1] : null
        const showDateSeparator = !prevMsg || !isSameDay(prevMsg.sent_at, msg.sent_at)

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-4">
                <div className="px-4 py-1.5 rounded-full bg-[#141414] border border-[#1e1e1e] text-[10px] text-[#666] font-medium tracking-wide">
                  {formatDateSeparator(msg.sent_at)}
                </div>
              </div>
            )}
            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {renderMedia(msg)}
              {msg.text && (
                <div
                  className={`px-4 py-2.5 max-w-[65%] text-[13.5px] leading-[1.5] break-words
                    ${isUser
                      ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] text-white rounded-[20px_20px_6px_20px] shadow-[0_2px_8px_rgba(229,62,62,0.2)]'
                      : 'bg-[#161616] border border-[#1e1e1e] text-[#e0e0e0] rounded-[20px_20px_20px_6px]'
                    }
                    ${isOptimistic ? 'opacity-60' : ''}
                  `}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {msg.text}
                </div>
              )}
              <div className={`text-[10px] text-[#4a4a4a] mt-1 px-1.5 flex items-center gap-1 ${isOptimistic ? 'italic' : ''}`}>
                {isOptimistic ? 'Envoi...' : formatTimestamp(msg.sent_at)}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
