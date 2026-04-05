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
    <div className="px-4 py-3 border-t border-[var(--border-primary)] flex gap-2 items-end">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ecrire un message..."
        rows={1}
        className="flex-1 px-3.5 py-2.5 text-[13px] bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl outline-none resize-none leading-[1.4] max-h-[120px] overflow-auto focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow placeholder:text-[var(--text-tertiary)]"
      />
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        className={`w-10 h-10 rounded-full border-none flex items-center justify-center shrink-0 transition-all duration-150
          ${hasText && !isBusy
            ? 'bg-[var(--color-primary)] cursor-pointer hover:opacity-90 active:scale-95'
            : 'bg-[var(--bg-elevated)] cursor-default'
          }
          ${isBusy ? 'opacity-60' : ''}
        `}
      >
        <Send size={16} className={hasText ? 'text-white' : 'text-[var(--text-tertiary)]'} />
      </button>
    </div>
  )
}
