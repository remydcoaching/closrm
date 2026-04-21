'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Search } from 'lucide-react'

interface LeadOption {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

interface NewEmailModalProps {
  onClose: () => void
  onSent: (conversationId: string) => void
}

export default function NewEmailModal({ onClose, onSent }: NewEmailModalProps) {
  const [mode, setMode] = useState<'lead' | 'email'>('lead')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<LeadOption[]>([])
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)
  const [freeEmail, setFreeEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced lead search
  useEffect(() => {
    if (mode !== 'lead' || !leadSearch.trim()) {
      setLeadResults([])
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads?search=${encodeURIComponent(leadSearch)}&limit=10`)
        const json = await res.json()
        const leads = Array.isArray(json) ? json : (json.data ?? [])
        setLeadResults(
          leads
            .filter((l: LeadOption) => l.email)
            .slice(0, 10),
        )
      } catch {
        setLeadResults([])
      }
    }, 250)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [leadSearch, mode])

  const canSend =
    !!subject.trim() &&
    !!body.trim() &&
    ((mode === 'lead' && !!selectedLead) || (mode === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(freeEmail)))

  async function handleSend() {
    if (!canSend || sending) return
    setSending(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        body_text: body,
        body_html: body.replace(/\n/g, '<br>'),
      }
      if (mode === 'lead' && selectedLead) {
        payload.lead_id = selectedLead.id
        payload.to_email = selectedLead.email
        payload.to_name = [selectedLead.first_name, selectedLead.last_name]
          .filter(Boolean)
          .join(' ') || null
      } else if (mode === 'email') {
        payload.to_email = freeEmail.trim()
      }

      const res = await fetch('/api/emails/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Envoi échoué')
        return
      }
      onSent(json.conversation_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '100%',
          maxHeight: '90vh',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Nouveau message
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setMode('lead')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: mode === 'lead' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'lead' ? '#fff' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Lead existant
            </button>
            <button
              onClick={() => setMode('email')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: mode === 'email' ? 'var(--color-primary)' : 'transparent',
                color: mode === 'email' ? '#fff' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Email libre
            </button>
          </div>

          {mode === 'lead' ? (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
                Destinataire
              </label>
              {selectedLead ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border-primary)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {[selectedLead.first_name, selectedLead.last_name].filter(Boolean).join(' ') ||
                        selectedLead.email}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {selectedLead.email}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLead(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 10,
                      padding: '8px 12px',
                    }}
                  >
                    <Search size={14} color="var(--text-tertiary)" />
                    <input
                      autoFocus
                      placeholder="Rechercher un lead (nom ou email)"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  {leadResults.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        border: '1px solid var(--border-primary)',
                        borderRadius: 10,
                        background: 'var(--bg-primary)',
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {leadResults.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => {
                            setSelectedLead(l)
                            setLeadSearch('')
                            setLeadResults([])
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {l.email}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
                Email destinataire
              </label>
              <input
                type="email"
                autoFocus
                placeholder="ex: jean.dupont@example.com"
                value={freeEmail}
                onChange={(e) => setFreeEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
              Sujet
            </label>
            <input
              type="text"
              placeholder="Sujet de l'email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
              Message
            </label>
            <textarea
              rows={8}
              placeholder="Votre message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: sending ? 'not-allowed' : 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            style={{
              padding: '9px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: !canSend || sending ? 'not-allowed' : 'pointer',
              opacity: !canSend || sending ? 0.5 : 1,
            }}
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}
