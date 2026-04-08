'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, MicOff, ImagePlus, X } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  onSendImage?: (file: File) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onSendImage, disabled }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const isBusy = sending || disabled

  const hasSpeechRecognition = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )

  const handleSend = async () => {
    if (isBusy) return

    // Send image if selected
    if (imagePreview && onSendImage) {
      setSending(true)
      try {
        await onSendImage(imagePreview.file)
        setImagePreview(null)
      } finally {
        setSending(false)
      }
      return
    }

    const trimmed = text.trim()
    if (!trimmed) return
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImagePreview({ file, url })
    e.target.value = ''
  }

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url)
    setImagePreview(null)
  }

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any
    const SpeechRecognitionClass = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (!SpeechRecognitionClass) return

    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: { results: { length: number; [i: number]: { 0: { transcript: string } } } }) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setText(transcript)
    }
    recognition.onerror = () => setRecording(false)
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const hasContent = text.trim().length > 0 || !!imagePreview

  return (
    <div style={{ borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
            <img src={imagePreview.url} alt="Preview" style={{ height: 80, borderRadius: 12, display: 'block' }} />
            <button
              onClick={clearImage}
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={12} color="#fff" />
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div style={{ padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        {/* Input container */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'flex-end',
          background: 'var(--bg-secondary)',
          border: recording ? '1px solid var(--color-primary)' : '1px solid var(--border-primary)',
          borderRadius: 24, padding: '4px 6px 4px 20px',
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
              flex: 1, padding: '10px 0', fontSize: 14, fontFamily: 'inherit',
              background: 'transparent', color: 'var(--text-primary)',
              border: 'none', outline: 'none', resize: 'none',
              lineHeight: 1.4, maxHeight: 120, overflow: 'auto',
            }}
          />

          {/* Photo button */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
            }}
            title="Envoyer une photo"
          >
            <ImagePlus size={18} color="var(--text-tertiary)" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* Mic button */}
          {hasSpeechRecognition && (
            <button
              type="button"
              onClick={toggleRecording}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: recording ? 'var(--color-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
              }}
              title={recording ? 'Arrêter' : 'Dictée vocale'}
            >
              {recording
                ? <MicOff size={16} color="#fff" />
                : <Mic size={18} color="var(--text-tertiary)" />
              }
            </button>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!hasContent || isBusy}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            cursor: hasContent && !isBusy ? 'pointer' : 'default',
            opacity: isBusy ? 0.5 : 1,
            background: hasContent && !isBusy ? 'var(--color-primary)' : 'var(--bg-elevated)',
            transition: 'all 0.2s',
          }}
        >
          <Send size={18} color={hasContent && !isBusy ? '#fff' : 'var(--text-tertiary)'} />
        </button>
      </div>
    </div>
  )
}
