'use client'

import { useState } from 'react'
import { Sparkles, Copy, ExternalLink, Send, Loader2, ChevronUp, ArrowRight } from 'lucide-react'
import { AiSuggestion } from '@/types'

interface Props {
  leadId: string
  conversationId?: string
  instagramHandle?: string | null
  onSendMessage?: (text: string) => void
}

export default function AiSuggestionPanel({ leadId, conversationId, instagramHandle, onSendMessage }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, conversation_id: conversationId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erreur')
        setState('error')
        return
      }
      setSuggestion(json.data)
      setEditedMessage(json.data.message)
      setState('ready')
    } catch {
      setError('Erreur de connexion')
      setState('error')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(editedMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSend() {
    if (onSendMessage && editedMessage.trim()) {
      onSendMessage(editedMessage.trim())
      setState('idle')
      setSuggestion(null)
    }
  }

  // Idle — just the button
  if (state === 'idle') {
    return (
      <button onClick={generate} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))',
        border: '1px solid rgba(168,85,247,0.25)',
        color: '#a855f7', fontSize: 13, fontWeight: 600,
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(59,130,246,0.15))' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))' }}
      >
        <Sparkles size={15} />
        Suggestion IA
      </button>
    )
  }

  // Loading
  if (state === 'loading') {
    return (
      <div style={{
        padding: '16px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))',
        border: '1px solid rgba(168,85,247,0.2)',
        display: 'flex', alignItems: 'center', gap: 10, color: '#a855f7', fontSize: 13,
      }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Analyse de la conversation en cours...
      </div>
    )
  }

  // Error
  if (state === 'error') {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      }}>
        <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px 0' }}>{error}</p>
        <button onClick={generate} style={{
          fontSize: 11, color: 'var(--text-tertiary)', background: 'none',
          border: '1px solid var(--border-primary)', borderRadius: 6,
          padding: '4px 10px', cursor: 'pointer',
        }}>Reessayer</button>
      </div>
    )
  }

  // Ready — show guidance + message
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid rgba(168,85,247,0.25)',
      background: 'linear-gradient(180deg, rgba(168,85,247,0.06) 0%, rgba(10,10,10,0.3) 100%)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid rgba(168,85,247,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <Sparkles size={12} />
          Assistant IA
        </div>
        <button onClick={() => { setState('idle'); setSuggestion(null) }} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 11,
        }}>
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Guidance */}
      {suggestion && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(168,85,247,0.1)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {suggestion.guidance}
          </p>
          {suggestion.status_suggestion && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 8, padding: '4px 10px', borderRadius: 6,
              background: 'rgba(56,161,105,0.1)', border: '1px solid rgba(56,161,105,0.2)',
              fontSize: 11, color: '#38A169',
            }}>
              <ArrowRight size={10} />
              Suggere : {suggestion.status_suggestion.to} — {suggestion.status_suggestion.reason}
            </div>
          )}
        </div>
      )}

      {/* Message editable */}
      <div style={{ padding: '12px 14px' }}>
        <textarea
          value={editedMessage}
          onChange={e => setEditedMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            borderRadius: 10, color: 'var(--text-primary)', fontSize: 13,
            outline: 'none', resize: 'vertical', lineHeight: 1.5,
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* Regenerate */}
          <button onClick={generate} style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 11,
            border: '1px solid var(--border-primary)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Sparkles size={11} />Regenerer
          </button>

          <div style={{ flex: 1 }} />

          {suggestion?.window_open && onSendMessage ? (
            /* Window open — send directly */
            <button onClick={handleSend} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(168,85,247,0.3)',
            }}>
              <Send size={12} />Envoyer
            </button>
          ) : (
            /* Window closed — copy + open IG */
            <>
              <button onClick={handleCopy} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)',
                color: '#a855f7', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Copy size={12} />{copied ? 'Copie !' : 'Copier'}
              </button>
              {instagramHandle && (
                <a
                  href={`https://www.instagram.com/${instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'linear-gradient(135deg, #E1306C, #C13584)', border: 'none',
                    color: '#fff', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <ExternalLink size={12} />Instagram
                </a>
              )}
            </>
          )}
        </div>

        {/* Window status */}
        {suggestion && !suggestion.window_open && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Fenetre de messagerie fermee — copiez le message et envoyez-le depuis Instagram
          </p>
        )}
      </div>
    </div>
  )
}
