'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Mail, Trash2, Loader2, RefreshCw, ShieldOff } from 'lucide-react'

interface Suppression {
  id: string
  email: string
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe'
  bounce_type: string | null
  bounce_subtype: string | null
  created_at: string
  workspace_id: string | null
}

const REASON_LABEL: Record<Suppression['reason'], string> = {
  bounce: 'Rebond',
  complaint: 'Plainte',
  unsubscribe: 'Désabonné',
  manual: 'Ajout manuel',
}

const REASON_COLOR: Record<Suppression['reason'], string> = {
  bounce: '#ef4444',
  complaint: '#f59e0b',
  unsubscribe: '#6b7280',
  manual: '#6b7280',
}

export default function SuppressionList() {
  const [items, setItems] = useState<Suppression[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/emails/suppressions')
      if (res.ok) {
        const json = await res.json()
        setItems(Array.isArray(json) ? json : (json.data ?? []))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUnblock(id: string, email: string) {
    if (!confirm(`Débloquer ${email} ? Les prochains envois vers cette adresse seront à nouveau autorisés (à vos risques si l'adresse n'existe plus).`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/emails/suppressions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems((prev) => prev.filter((s) => s.id !== id))
      }
    } finally {
      setDeleting(null)
    }
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldOff size={18} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Adresses bloquées
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'var(--bg-hover)',
              color: 'var(--text-muted)',
            }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-primary)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Rafraîchir
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Liste des adresses pour lesquelles l&apos;envoi est bloqué : rebonds permanents, plaintes SPAM et désabonnements. Ces adresses sont automatiquement protégées pour préserver votre réputation d&apos;expéditeur.
      </p>

      {loading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 24,
            fontSize: 13,
            color: 'var(--text-muted)',
            background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
            borderRadius: 8,
          }}
        >
          Aucune adresse bloquée. Continuez comme ça !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((s) => {
            const isGlobal = s.workspace_id === null
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-input)',
                }}
              >
                <Mail size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.email}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {s.bounce_type && ` • ${s.bounce_type}${s.bounce_subtype ? '/' + s.bounce_subtype : ''}`}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: REASON_COLOR[s.reason] + '18',
                    color: REASON_COLOR[s.reason],
                    border: `1px solid ${REASON_COLOR[s.reason]}30`,
                    flexShrink: 0,
                  }}
                >
                  {REASON_LABEL[s.reason]}
                </span>
                {isGlobal ? (
                  <span
                    title="Suppression globale — contacter le support pour débloquer"
                    style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  >
                    <AlertTriangle size={14} />
                  </span>
                ) : (
                  <button
                    onClick={() => handleUnblock(s.id, s.email)}
                    disabled={deleting === s.id}
                    title="Débloquer"
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid var(--border-primary)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {deleting === s.id ? (
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
