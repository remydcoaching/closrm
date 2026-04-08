'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const isBusy = sending || disabled

  // Check if speech recognition is available
  const hasSpeechRecognition = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )

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

  const toggleRecording = () => {
    if (recording) {
      // Stop recording
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    // Start recording
    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setText(transcript)
    }

    recognition.onerror = () => {
      setRecording(false)
    }

    recognition.onend = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

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
      {/* Text input container */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'var(--bg-secondary)',
        border: recording ? '1px solid var(--color-primary)' : '1px solid var(--border-primary)',
        borderRadius: 24,
        padding: '4px 6px 4px 20px',
        transition: 'border-color 0.2s',
      }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={recording ? 'Parlez maintenant...' : 'Votre message...'}
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
        {hasSpeechRecognition && (
          <button
            type="button"
            onClick={toggleRecording}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: recording ? 'var(--color-primary)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
            title={recording ? 'Arrêter la dictée' : 'Dictée vocale'}
          >
            {recording
              ? <MicOff size={16} color="#fff" />
              : <Mic size={16} color="var(--text-tertiary)" />
            }
          </button>
        )}
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
