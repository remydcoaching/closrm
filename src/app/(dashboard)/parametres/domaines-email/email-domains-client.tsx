'use client'

import { useEffect, useState, useCallback } from 'react'
import { Mail, Plus, RefreshCw, Trash2, Copy, Check, AlertCircle, X, Loader2 } from 'lucide-react'
import type { EmailDomain, EmailDomainStatus, ResendDnsRecord } from '@/types'

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
}

const buttonPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  background: '#E53E3E',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
}

const buttonGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 12,
}

const STATUS_META: Record<EmailDomainStatus, { label: string; bg: string; color: string }> = {
  pending: { label: 'En attente', bg: 'rgba(214,158,46,0.15)', color: '#D69E2E' },
  verified: { label: 'Vérifié', bg: 'rgba(56,161,105,0.15)', color: '#38A169' },
  failed: { label: 'Échec', bg: 'rgba(229,62,62,0.15)', color: '#E53E3E' },
}

export default function EmailDomainsClient() {
  const [domains, setDomains] = useState<EmailDomain[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/emails/domains')
    if (!res.ok) {
      setError('Impossible de charger les domaines.')
      return
    }
    const data = (await res.json()) as EmailDomain[]
    setDomains(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Chargement…</div>
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Domaines email
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 600, lineHeight: 1.5 }}>
            Envoyez vos emails depuis votre propre nom de domaine (au lieu de noreply@closrm.fr).
            Configurez les enregistrements DNS chez votre registrar (OVH, GoDaddy, Cloudflare…) puis vérifiez.
          </p>
        </div>
        <button style={buttonPrimary} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Ajouter un domaine
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(229,62,62,0.12)',
            border: '1px solid rgba(229,62,62,0.3)',
            borderRadius: 8,
            color: '#E53E3E',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {!domains || domains.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
          <Mail size={40} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Aucun domaine configuré. Vos emails partent actuellement de <strong>noreply@closrm.fr</strong>.
          </p>
          <button style={buttonPrimary} onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Ajouter mon premier domaine
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {domains.map((d) => (
            <DomainCard key={d.id} domain={d} onChange={refresh} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddDomainModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

// ─── Domain Card ────────────────────────────────────────────────────────────

function DomainCard({ domain, onChange }: { domain: EmailDomain; onChange: () => void }) {
  const [verifying, setVerifying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDns, setShowDns] = useState(domain.status !== 'verified')
  const [fromEmail, setFromEmail] = useState(domain.default_from_email || `noreply@${domain.domain}`)
  const [fromName, setFromName] = useState(domain.default_from_name || '')
  const [savingFrom, setSavingFrom] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const status = STATUS_META[domain.status]

  async function handleVerify() {
    setVerifying(true)
    try {
      await fetch(`/api/emails/domains/${domain.id}/verify`, { method: 'POST' })
      onChange()
    } finally {
      setVerifying(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le domaine ${domain.domain} ?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/emails/domains/${domain.id}`, { method: 'DELETE' })
      onChange()
    } finally {
      setDeleting(false)
    }
  }

  async function handleSaveFrom() {
    setSavingFrom(true)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/emails/domains/${domain.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_from_email: fromEmail, default_from_name: fromName }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setUpdateError(j.error || 'Erreur lors de la mise à jour.')
      } else {
        setSavedAt(Date.now())
        onChange()
      }
    } finally {
      setSavingFrom(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} color="var(--text-tertiary)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{domain.domain}</div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '2px 8px',
                background: status.bg,
                color: status.color,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {domain.status !== 'verified' && (
            <button style={buttonGhost} onClick={handleVerify} disabled={verifying}>
              {verifying ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              Vérifier
            </button>
          )}
          <button
            style={{ ...buttonGhost, color: '#E53E3E', borderColor: 'rgba(229,62,62,0.3)' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* DNS records */}
      {(showDns || domain.status !== 'verified') && domain.dns_records && domain.dns_records.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Enregistrements DNS à configurer
            </div>
            {domain.status === 'verified' && (
              <button style={buttonGhost} onClick={() => setShowDns(false)}>
                Masquer
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Connectez-vous à votre registrar (OVH, GoDaddy, Cloudflare…) et ajoutez chacun de ces enregistrements
            dans la zone DNS de <strong>{domain.domain}</strong>. La propagation prend généralement 5 min à 1h.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {domain.dns_records.map((r, i) => (
              <DnsRecordRow key={i} record={r} domain={domain.domain} />
            ))}
          </div>
        </div>
      )}

      {/* Default from (only if verified) */}
      {domain.status === 'verified' && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Expéditeur par défaut
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Email expéditeur
              </label>
              <input
                style={inputStyle}
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder={`noreply@${domain.domain}`}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Doit se terminer par <code style={{ color: 'var(--text-secondary)' }}>@{domain.domain}</code>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Nom expéditeur
              </label>
              <input
                style={inputStyle}
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Jean Dupont Coaching"
              />
            </div>
          </div>
          {updateError && (
            <div style={{ padding: '8px 12px', background: 'rgba(229,62,62,0.12)', borderRadius: 6, color: '#E53E3E', fontSize: 12, marginBottom: 8 }}>
              {updateError}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={buttonPrimary} onClick={handleSaveFrom} disabled={savingFrom}>
              {savingFrom ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              Enregistrer
            </button>
            {savedAt && Date.now() - savedAt < 3000 && (
              <span style={{ fontSize: 12, color: '#38A169' }}>✓ Enregistré</span>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

// ─── DNS row ────────────────────────────────────────────────────────────────

function DnsRecordRow({ record, domain }: { record: ResendDnsRecord; domain: string }) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  function copy(field: string, value: string) {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // Le "name" de Resend contient déjà le domaine complet (ex: "send.coach.fr").
  // Pour OVH/GoDaddy, l'utilisateur doit retirer ".coach.fr" du sous-domaine.
  const subdomain = record.name.endsWith(`.${domain}`)
    ? record.name.slice(0, -(domain.length + 1))
    : record.name === domain
      ? '@'
      : record.name

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 2fr 80px',
        gap: 8,
        padding: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 6,
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{record.type}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <code style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subdomain}
        </code>
        <button
          onClick={() => copy('name', subdomain)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          title="Copier le sous-domaine"
        >
          {copiedField === 'name' ? <Check size={12} color="#38A169" /> : <Copy size={12} />}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <code style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.value}
        </code>
        <button
          onClick={() => copy('value', record.value)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
          title="Copier la valeur"
        >
          {copiedField === 'value' ? <Check size={12} color="#38A169" /> : <Copy size={12} />}
        </button>
      </div>
      <div style={{ textAlign: 'right' }}>
        {record.status === 'verified' ? (
          <Check size={14} color="#38A169" />
        ) : (
          <AlertCircle size={14} color="#D69E2E" />
        )}
      </div>
    </div>
  )
}

// ─── Add Domain Modal ───────────────────────────────────────────────────────

function AddDomainModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [domain, setDomain] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!value || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) {
      setError('Nom de domaine invalide. Exemple : coach.fr')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/emails/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Erreur lors de la création.')
        return
      }
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Ajouter un domaine</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
            Nom de domaine
          </label>
          <input
            style={inputStyle}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="coach.fr"
            autoFocus
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            Saisissez votre nom de domaine racine (ex: <code>coach.fr</code>, pas <code>www.coach.fr</code>).
            Vous devez en être propriétaire et avoir accès à sa zone DNS.
          </p>
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: 'rgba(229,62,62,0.12)',
                borderRadius: 6,
                color: '#E53E3E',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={buttonGhost}>
              Annuler
            </button>
            <button type="submit" disabled={submitting} style={buttonPrimary}>
              {submitting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>
        </form>
        <style jsx>{`
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  )
}
