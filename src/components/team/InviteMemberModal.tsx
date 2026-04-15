'use client'

import { useState } from 'react'
import { X, Copy, Check, RefreshCw, PhoneOutgoing, Target } from 'lucide-react'
import type { WorkspaceRole } from '@/types'

function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let pass = ''
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

interface InviteMemberModalProps {
  onClose: () => void
  onSuccess: () => void
}

type Step = 'form' | 'success'

export default function InviteMemberModal({ onClose, onSuccess }: InviteMemberModalProps) {
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [role, setRole] = useState<WorkspaceRole>('setter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Credentials kept after success
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, password, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur lors de l\'invitation')

      setCredentials({ email, password })
      setStep('success')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback: do nothing
    }
  }

  function copyAll() {
    if (!credentials) return
    const text = `Email : ${credentials.email}\nMot de passe : ${credentials.password}`
    copyToClipboard(text, 'all')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 0, width: '100%', maxWidth: 460,
        boxShadow: '0 24px 64px var(--shadow-dropdown)',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border-primary)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {step === 'form' ? 'Inviter un membre' : 'Membre invite !'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid var(--border-primary)',
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="membre@exemple.com"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              />
            </div>

            {/* Full name */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nom complet</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jean Dupont"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Mot de passe</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
                    letterSpacing: '0.05em',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  title="Generer"
                  style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(password, 'pw')}
                  title="Copier"
                  style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                    color: copied === 'pw' ? '#38A169' : 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  {copied === 'pw' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Role selector */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Role</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {([
                  { value: 'setter' as WorkspaceRole, label: 'Setter', desc: 'Qualifie les leads', icon: PhoneOutgoing, color: '#3b82f6' },
                  { value: 'closer' as WorkspaceRole, label: 'Closer', desc: 'Conclut les ventes', icon: Target, color: '#38A169' },
                ] as const).map(opt => {
                  const selected = role === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      style={{
                        flex: 1, padding: '14px 16px', borderRadius: 10,
                        background: selected ? `${opt.color}12` : 'var(--bg-primary)',
                        border: `2px solid ${selected ? opt.color : 'var(--border-primary)'}`,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Icon size={16} style={{ color: selected ? opt.color : 'var(--text-muted)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: selected ? opt.color : 'var(--text-primary)' }}>
                          {opt.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 24 }}>
                        {opt.desc}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
                color: '#E53E3E', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                background: 'var(--color-primary)', color: '#000',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Invitation en cours...' : 'Inviter'}
            </button>
          </form>
        ) : (
          /* Success step — show credentials */
          <div style={{ padding: '20px 24px 24px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Le membre a ete cree. Partagez-lui ces identifiants pour qu&apos;il puisse se connecter.
            </p>

            {credentials && (
              <div style={{
                background: 'var(--bg-primary)', borderRadius: 10,
                border: '1px solid var(--border-primary)', padding: 16,
                marginBottom: 20,
              }}>
                {/* Email */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Email
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace' }}>
                      {credentials.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(credentials.email, 'cred-email')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === 'cred-email' ? '#38A169' : 'var(--text-muted)', padding: 4 }}
                    >
                      {copied === 'cred-email' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Mot de passe
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 6,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace' }}>
                      {credentials.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(credentials.password, 'cred-pw')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === 'cred-pw' ? '#38A169' : 'var(--text-muted)', padding: 4 }}
                    >
                      {copied === 'cred-pw' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Copy all + close */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={copyAll}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'transparent', border: '1px solid var(--border-primary)',
                  color: copied === 'all' ? '#38A169' : 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                {copied === 'all' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'all' ? 'Copie !' : 'Copier tout'}
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)', color: '#000',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
