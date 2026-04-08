'use client'

import { useState, useRef } from 'react'
import { Send, Mic } from 'lucide-react'

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
    <div className="px-6 py-4 border-t border-[var(--border-primary)] flex gap-3 items-end shrink-0">
      <textarea
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Votre message..."
        rows={1}
        className="flex-1 px-5 py-3 text-[14px] bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-[24px] outline-none resize-none leading-[1.4] max-h-[120px] overflow-auto focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow placeholder:text-[var(--text-tertiary)]"
        style={{ fontFamily: 'inherit' }}
      />

      {/* Voice button */}
      <button
        type="button"
        className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-primary)] flex items-center justify-center shrink-0 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
        title="Message vocal"
      >
        <Mic size={16} className="text-[var(--text-tertiary)]" />
      </button>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        className={`w-10 h-10 rounded-full border-none flex items-center justify-center shrink-0 transition-all duration-200
          ${hasText && !isBusy
            ? 'cursor-pointer hover:opacity-90 active:scale-95'
            : 'cursor-default'
          }
          ${isBusy ? 'opacity-50' : ''}
        `}
        style={{
          background: hasText && !isBusy ? 'var(--color-primary)' : 'var(--bg-elevated)',
          boxShadow: hasText && !isBusy ? '0 2px 12px rgba(0,200,83,0.3)' : 'none',
        }}
      >
        <Send size={16} color={hasText && !isBusy ? '#fff' : 'var(--text-tertiary)'} />
      </button>
    </div>
  )
}
