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
    <div style={{
      padding: '16px 24px',
      borderTop: '1px solid var(--border-primary)',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
      flexShrink: 0,
    }}>
      {/* Text input */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 24,
        padding: '4px 6px 4px 20px',
        transition: 'border-color 0.2s',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Votre message..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 14,
            fontFamily: 'inherit',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.4,
            maxHeight: 120,
            overflow: 'auto',
          }}
        />

        {/* Mic button inside input */}
        <button
          type="button"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Message vocal"
        >
          <Mic size={18} color="var(--text-tertiary)" />
        </button>
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: hasText && !isBusy ? 'pointer' : 'default',
          opacity: isBusy ? 0.5 : 1,
          background: hasText && !isBusy ? 'var(--color-primary)' : 'var(--bg-elevated)',
          transition: 'all 0.2s',
        }}
      >
        <Send size={18} color={hasText && !isBusy ? '#fff' : 'var(--text-tertiary)'} />
      </button>
    </div>
  )
}
