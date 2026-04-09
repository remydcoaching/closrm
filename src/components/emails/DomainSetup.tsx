'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EmailDomain, ResendDnsRecord } from '@/types'

export default function DomainSetup() {
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [error, setError] = useState('')
  const [editFrom, setEditFrom] = useState({ email: '', name: '' })
  const [savingFrom, setSavingFrom] = useState(false)

  const fetchDomains = useCallback(async () => {
    const res = await fetch('/api/emails/domains')
    if (res.ok) {
      const data = await res.json()
      setDomains(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchDomains() }, [fetchDomains])

  const domain = domains[0]

  useEffect(() => {
    if (domain?.status === 'verified') {
      setEditFrom({
        email: domain.default_from_email || '',
        name: domain.default_from_name || '',
      })
    }
  }, [domain])

  async function handleAdd() {
    if (!newDomain.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/emails/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: newDomain }),
    })
    if (res.ok) {
      setNewDomain('')
      await fetchDomains()
    } else {
      const data = await res.json()
      setError(data.error || 'Erreur')
    }
    setAdding(false)
  }

  async function handleVerify() {
    if (!domain) return
    setVerifying(true)
    setError('')
    const res = await fetch(`/api/emails/domains/${domain.id}/verify`, { method: 'POST' })
    if (res.ok) {
      await fetchDomains()
    } else {
      const data = await res.json()
      setError(data.error || 'Erreur de vérification')
    }
    setVerifying(false)
  }

  async function handleDelete() {
    if (!domain || !confirm('Supprimer ce domaine ?')) return
    await fetch(`/api/emails/domains/${domain.id}`, { method: 'DELETE' })
    setDomains([])
  }

  async function handleSaveFrom() {
    if (!domain) return
    setSavingFrom(true)
    await fetch(`/api/emails/domains/${domain.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        default_from_email: editFrom.email,
        default_from_name: editFrom.name,
      }),
    })
    await fetchDomains()
    setSavingFrom(false)
  }

  const [copiedText, setCopiedText] = useState('')

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(''), 1500)
  }

  if (loading) {
    return <CardShell><span style={{ color: '#666', fontSize: 13 }}>Chargement...</span></CardShell>
  }

  // No domain configured
  if (!domain) {
    return (
      <CardShell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <IconBox color="#8B5CF6">@</IconBox>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>Domaine Email</div>
            <div style={{ fontSize: 12, color: '#555' }}>Envoie tes emails depuis ton propre domaine</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            placeholder="mondomaine.com"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{
              flex: 1, padding: '12px 16px', fontSize: 15,
              background: '#0a0a0a', border: '1px solid #333', borderRadius: 10,
              color: '#fff', outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              borderRadius: 10, cursor: 'pointer', opacity: adding ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? 'Ajout...' : 'Ajouter le domaine'}
          </button>
        </div>

        {error && <div style={{ fontSize: 12, color: '#E53E3E', marginBottom: 8 }}>{error}</div>}

        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          Tu n&apos;as pas encore de domaine ? Achete-en un sur{' '}
          <a href="https://www.ovh.com" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'underline' }}>OVH</a>,{' '}
          <a href="https://www.namecheap.com" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'underline' }}>Namecheap</a> ou{' '}
          <a href="https://www.godaddy.com" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'underline' }}>GoDaddy</a>,
          puis reviens ici pour le connecter.
        </div>
      </CardShell>
    )
  }

  // Domain pending
  if (domain.status === 'pending' || domain.status === 'failed') {
    return (
      <CardShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconBox color="#8B5CF6">@</IconBox>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                {domain.domain}
              </div>
              <div style={{ fontSize: 12, color: domain.status === 'failed' ? '#E53E3E' : '#D69E2E' }}>
                {domain.status === 'failed' ? 'Vérification échouée' : 'En attente de vérification DNS'}
              </div>
            </div>
          </div>
          <button onClick={handleDelete} style={{
            fontSize: 11, color: '#555', background: 'none', border: '1px solid #333',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          }}>
            Supprimer
          </button>
        </div>

        <div style={{
          background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8,
          padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#888', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#ccc' }}>Instructions :</strong> Allez dans votre espace client OVH (ou autre registrar) &gt; DNS Zone &gt; Ajouter une entree.
          Copiez chaque enregistrement ci-dessous et ajoutez-le comme entree DNS. La propagation peut prendre jusqu&apos;a 48h.
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Type', 'Nom', 'Valeur', 'Statut', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(domain.dns_records || []).map((record: ResendDnsRecord, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '10px', color: '#ccc', fontFamily: 'monospace', fontWeight: 600 }}>{record.type}</td>
                  <td style={{ padding: '10px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</td>
                  <td style={{ padding: '10px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.value}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500,
                      background: record.status === 'verified'
                        ? 'rgba(0,200,83,0.1)'
                        : record.status === 'failed'
                          ? 'rgba(229,62,62,0.1)'
                          : 'rgba(214,158,46,0.1)',
                      color: record.status === 'verified'
                        ? '#00C853'
                        : record.status === 'failed'
                          ? '#E53E3E'
                          : '#D69E2E',
                    }}>
                      {record.status === 'verified' ? 'Verifie' : record.status === 'failed' ? 'Echoue' : 'En attente'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button onClick={() => copyToClipboard(record.value)} style={{
                      fontSize: 11, color: copiedText === record.value ? '#00C853' : '#888',
                      background: '#1a1a1a', border: '1px solid #333',
                      borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}>
                      {copiedText === record.value ? 'Copie !' : 'Copier'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <div style={{ fontSize: 12, color: '#E53E3E', marginBottom: 8 }}>{error}</div>}

        <button onClick={handleVerify} disabled={verifying} style={{
          padding: '10px 24px', fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer', opacity: verifying ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {verifying && (
            <span style={{
              width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              display: 'inline-block', animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {verifying ? 'Verification en cours...' : 'Verifier les DNS'}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </CardShell>
    )
  }

  // Domain verified
  return (
    <CardShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconBox color="#00C853">@</IconBox>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              {domain.domain}
            </div>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(0,200,83,0.1)', color: '#00C853',
            }}>
              Vérifié
            </span>
          </div>
        </div>
        <button onClick={handleDelete} style={{
          fontSize: 11, color: '#555', background: 'none', border: '1px solid #333',
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
        }}>
          Déconnecter
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Nom affiché</label>
          <input
            type="text"
            value={editFrom.name}
            onChange={e => setEditFrom(p => ({ ...p, name: e.target.value }))}
            placeholder="Mon Coaching"
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
              color: '#fff', outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }}>Adresse d&apos;envoi</label>
          <input
            type="email"
            value={editFrom.email}
            onChange={e => setEditFrom(p => ({ ...p, email: e.target.value }))}
            placeholder={`contact@${domain.domain}`}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 13,
              background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
              color: '#fff', outline: 'none',
            }}
          />
        </div>
      </div>

      <button onClick={handleSaveFrom} disabled={savingFrom} style={{
        padding: '7px 16px', fontSize: 12, fontWeight: 600,
        background: '#1a1a1a', color: '#fff', border: '1px solid #333',
        borderRadius: 8, cursor: 'pointer', opacity: savingFrom ? 0.6 : 1,
      }}>
        {savingFrom ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </CardShell>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      {children}
    </div>
  )
}

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700, color,
    }}>
      {children}
    </div>
  )
}
