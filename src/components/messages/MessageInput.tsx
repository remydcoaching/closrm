'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface Props { onSend: (text: string) => void }

export default function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    await onSend(trimmed)
    setText('')
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
        placeholder="Écrire un message..." rows={1}
        style={{ flex: 1, padding: '10px 14px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 12, outline: 'none', resize: 'none', lineHeight: 1.4, maxHeight: 120, overflow: 'auto' }} />
      <button onClick={handleSend} disabled={!text.trim() || sending}
        style={{ width: 40, height: 40, borderRadius: '50%', background: text.trim() ? 'var(--color-primary)' : 'var(--bg-elevated)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.6 : 1 }}>
        <Send size={16} style={{ color: text.trim() ? '#fff' : 'var(--text-tertiary)' }} />
      </button>
    </div>
  )
}
