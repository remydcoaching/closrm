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
      padding: '14px 24px',
      borderTop: '1px solid #1a1a1a',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
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
          padding: '12px 18px',
          fontSize: 14,
          fontFamily: 'inherit',
          background: '#111',
          color: '#ddd',
          border: '1px solid #1e1e1e',
          borderRadius: 24,
          outline: 'none',
          resize: 'none',
          lineHeight: 1.4,
          maxHeight: 120,
          overflow: 'auto',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => { e.target.style.borderColor = '#2a2a2a' }}
        onBlur={e => { e.target.style.borderColor = '#1e1e1e' }}
      />

      {/* Voice button */}
      <button
        type="button"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: '#151515',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#1e1e1e' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#151515' }}
        title="Message vocal"
      >
        <Mic size={16} color="#555" />
      </button>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!hasText || isBusy}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: hasText && !isBusy ? 'pointer' : 'default',
          opacity: isBusy ? 0.5 : 1,
          background: hasText && !isBusy
            ? 'linear-gradient(135deg, #E53E3E, #C53030)'
            : '#151515',
          transition: 'all 0.2s',
          boxShadow: hasText && !isBusy ? '0 2px 12px rgba(229,62,62,0.3)' : 'none',
        }}
      >
        <Send size={16} color={hasText && !isBusy ? '#fff' : '#333'} />
      </button>
    </div>
  )
}
