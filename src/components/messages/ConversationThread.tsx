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
  if (isToday(dateStr)) {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
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
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
      {messages.map((msg, idx) => {
        const isUser = msg.sender_type === 'user'
        const isOptimistic = msg._optimistic
        const prevMsg = idx > 0 ? messages[idx - 1] : null
        const showDateSeparator = !prevMsg || !isSameDay(prevMsg.sent_at, msg.sent_at)

        return (
          <div key={msg.id}>
            {showDateSeparator && (
              <div className="flex items-center justify-center my-3">
                <div className="px-3 py-1 rounded-full bg-[#151515] border border-[#1f1f1f] text-[10px] text-[#555] font-medium">
                  {formatDateSeparator(msg.sent_at)}
                </div>
              </div>
            )}
            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {renderMedia(msg)}
              {msg.text && (
                <div
                  className={`px-4 py-[10px] max-w-[300px] text-[13px] leading-[1.45] break-words
                    ${isUser
                      ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] text-white rounded-[18px_18px_6px_18px]'
                      : 'bg-[#151515] border border-[#1f1f1f] text-[#ddd] rounded-[18px_18px_18px_6px]'
                    }
                    ${isOptimistic ? 'opacity-60' : ''}
                  `}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {msg.text}
                </div>
              )}
              <div className={`text-[9px] text-[#444] mt-[3px] px-[6px] flex items-center gap-1 ${isOptimistic ? 'italic' : ''}`}>
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
