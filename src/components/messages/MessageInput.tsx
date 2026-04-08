'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isBusy = sending || disabled

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const hasText = text.trim().length > 0

  return (
    <div className="px-5 py-3 border-t border-[#1a1a1a] flex gap-3 items-end shrink-0">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Écrire un message..."
        rows={1}
        className="flex-1 px-4 py-2.5 text-[13px] bg-[#111] text-[#ddd] border border-[#1e1e1e] rounded-xl outline-none resize-none leading-[1.4] max-h-[120px] overflow-auto focus:border-[#2a2a2a] transition-colors placeholder:text-[#3a3a3a]"
      />
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        className={`w-9 h-9 rounded-full border-none flex items-center justify-center shrink-0 transition-all duration-150
          ${hasText && !isBusy
            ? 'bg-gradient-to-br from-[#E53E3E] to-[#C53030] cursor-pointer hover:opacity-90 active:scale-95'
            : 'bg-[#1a1a1a] cursor-default'
          }
          ${isBusy ? 'opacity-60' : ''}
        `}
      >
        <Send size={14} className={hasText && !isBusy ? 'text-white' : 'text-[#333]'} />
      </button>
    </div>
  )
}
