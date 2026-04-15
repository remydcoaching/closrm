# Email DNS Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat DNS setup with a guided 4-step wizard (domain → cleanup → records one-by-one → live verification polling).

**Architecture:** Single new component `DomainWizard.tsx` replaces `DomainSetup.tsx`. State machine with 4 steps. Live polling via setInterval on step 4. Background polling added to existing cron. No new API routes needed — existing verify endpoint is reused.

**Tech Stack:** React (client component), Next.js API Routes, Resend API, Supabase

**Spec:** `docs/superpowers/specs/2026-04-10-email-dns-wizard-design.md`

---

### Task 1: Create DomainWizard component — Step 1 (Domain input)

**Files:**
- Create: `src/components/emails/DomainWizard.tsx`

- [ ] **Step 1: Create the component with step 1 only**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Globe, ChevronRight, Loader2, Trash2, Copy, Check, AlertTriangle, CheckCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'
import type { EmailDomain, ResendDnsRecord } from '@/types'

type WizardStep = 'domain' | 'cleanup' | 'records' | 'verify' | 'done'

interface DomainWizardProps {
  existingDomain: EmailDomain | null
  onDomainChange: () => void
}

const STEPS: { key: WizardStep; label: string; number: number }[] = [
  { key: 'domain', label: 'Domaine', number: 1 },
  { key: 'cleanup', label: 'Nettoyage', number: 2 },
  { key: 'records', label: 'Records DNS', number: 3 },
  { key: 'verify', label: 'Vérification', number: 4 },
]

export default function DomainWizard({ existingDomain, onDomainChange }: DomainWizardProps) {
  // Determine initial step from existing domain
  const getInitialStep = (): WizardStep => {
    if (!existingDomain) return 'domain'
    if (existingDomain.status === 'verified') return 'done'
    return 'verify' // pending or failed → resume at verification
  }

  const [step, setStep] = useState<WizardStep>(getInitialStep)
  const [domain, setDomain] = useState(existingDomain?.domain ?? '')
  const [domainData, setDomainData] = useState<EmailDomain | null>(existingDomain)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Cleanup checkboxes
  const [cleanupChecks, setCleanupChecks] = useState({ mx: false, spf: false, dkim: false })

  // Records step
  const [currentRecordIndex, setCurrentRecordIndex] = useState(0)

  // Verify polling
  const [polling, setPolling] = useState(false)

  // From email/name (done step)
  const [fromEmail, setFromEmail] = useState(existingDomain?.default_from_email ?? '')
  const [fromName, setFromName] = useState(existingDomain?.default_from_name ?? '')
  const [savingFrom, setSavingFrom] = useState(false)

  const dnsRecords: ResendDnsRecord[] = (domainData?.dns_records ?? []) as ResendDnsRecord[]

  // Copy to clipboard
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ─── Step 1: Add domain ─────────────────────────────────────────────
  async function handleAddDomain() {
    if (!domain.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/emails/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erreur lors de l\'ajout du domaine')
        return
      }
      setDomainData(json.data)
      setStep('cleanup')
      onDomainChange()
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 4: Verify ─────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (!domainData) return
    setPolling(true)
    try {
      const res = await fetch(`/api/emails/domains/${domainData.id}/verify`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json()
        setDomainData(json.data)
        if (json.data.status === 'verified') {
          setStep('done')
          setFromEmail(json.data.default_from_email ?? `contact@${json.data.domain}`)
          setFromName(json.data.default_from_name ?? '')
          onDomainChange()
        }
      }
    } catch {
      // silent — will retry
    } finally {
      setPolling(false)
    }
  }, [domainData, onDomainChange])

  // Auto-poll every 30s on verify step
  useEffect(() => {
    if (step !== 'verify' || !domainData) return
    handleVerify() // immediate first check
    const interval = setInterval(handleVerify, 30000)
    return () => clearInterval(interval)
  }, [step, domainData, handleVerify])

  // ─── Done: Save from ────────────────────────────────────────────────
  async function handleSaveFrom() {
    if (!domainData) return
    setSavingFrom(true)
    try {
      await fetch(`/api/emails/domains/${domainData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_from_email: fromEmail, default_from_name: fromName }),
      })
      onDomainChange()
    } finally {
      setSavingFrom(false)
    }
  }

  // ─── Delete domain ──────────────────────────────────────────────────
  async function handleDelete() {
    if (!domainData) return
    if (!confirm('Supprimer ce domaine ? Cette action est irréversible.')) return
    await fetch(`/api/emails/domains/${domainData.id}`, { method: 'DELETE' })
    setDomainData(null)
    setDomain('')
    setStep('domain')
    setCleanupChecks({ mx: false, spf: false, dkim: false })
    setCurrentRecordIndex(0)
    onDomainChange()
  }

  // ─── Styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
    borderRadius: 8, padding: '10px 14px', fontSize: 14,
    color: 'var(--text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--color-primary)', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#000',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--border-primary)', borderRadius: 8,
    padding: '10px 20px', fontSize: 13, color: 'var(--text-tertiary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }

  // ─── Progress bar ───────────────────────────────────────────────────
  function renderProgressBar() {
    if (step === 'done') return null
    const currentIdx = STEPS.findIndex(s => s.key === step)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {STEPS.map((s, i) => {
          const isDone = i < currentIdx
          const isCurrent = i === currentIdx
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                background: isDone ? 'var(--color-primary)' : isCurrent ? 'var(--color-primary)' : 'var(--bg-hover)',
                color: isDone || isCurrent ? '#000' : 'var(--text-muted)',
                transition: 'all 0.3s',
              }}>
                {isDone ? <Check size={14} /> : s.number}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, marginLeft: 6, whiteSpace: 'nowrap',
                color: isDone || isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginLeft: 10, marginRight: 10,
                  background: isDone ? 'var(--color-primary)' : 'var(--border-primary)',
                  borderRadius: 1, transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── STEP 1: Domain ─────────────────────────────────────────────────
  if (step === 'domain') {
    return (
      <div>
        {renderProgressBar()}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Quel est votre domaine ?
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
          Entrez le domaine depuis lequel vous souhaitez envoyer vos emails.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
              placeholder="moncoaching.fr"
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>
          <button onClick={handleAddDomain} disabled={loading || !domain.trim()} style={{ ...btnPrimary, opacity: loading || !domain.trim() ? 0.5 : 1 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronRight size={14} />}
            Continuer
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '16px 0 0' }}>
          Utilisez votre domaine principal (ex: moncoaching.fr) ou un sous-domaine (ex: mail.moncoaching.fr)
        </p>
      </div>
    )
  }

  // ─── STEP 2: Cleanup ────────────────────────────────────────────────
  if (step === 'cleanup') {
    const allChecked = cleanupChecks.mx || cleanupChecks.spf || cleanupChecks.dkim
    return (
      <div>
        {renderProgressBar()}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Nettoyez vos anciens records DNS
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
          Avant d&apos;ajouter les nouveaux records, supprimez les anciens pour éviter les conflits.
          Si vous n&apos;en avez pas, cochez quand même pour continuer.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {[
            { key: 'mx' as const, label: 'Records MX existants', desc: 'Supprimez les anciens records MX sur ce domaine/sous-domaine' },
            { key: 'spf' as const, label: 'Records TXT (SPF)', desc: 'Supprimez les records TXT contenant "v=spf1"' },
            { key: 'dkim' as const, label: 'Records CNAME (DKIM)', desc: 'Supprimez les anciens records CNAME de type DKIM' },
          ].map(item => (
            <label
              key={item.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${cleanupChecks[item.key] ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                background: cleanupChecks[item.key] ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.04)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={cleanupChecks[item.key]}
                onChange={e => setCleanupChecks(prev => ({ ...prev, [item.key]: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--color-primary)' }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Registrar guides */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-label)', marginBottom: 8 }}>
            Guides par hébergeur
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { name: 'OVH', url: 'https://www.ovh.com/manager/' },
              { name: 'Namecheap', url: 'https://ap.www.namecheap.com/' },
              { name: 'GoDaddy', url: 'https://dcc.godaddy.com/' },
              { name: 'Ionos', url: 'https://my.ionos.fr/' },
              { name: 'Hostinger', url: 'https://hpanel.hostinger.com/' },
            ].map(r => (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-secondary)', fontSize: 12, textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {r.name} <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setStep('domain')} style={btnSecondary}>Retour</button>
          <button onClick={() => setStep('records')} disabled={!allChecked} style={{ ...btnPrimary, opacity: allChecked ? 1 : 0.5 }}>
            C&apos;est fait, continuer <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ─── STEP 3: Records one by one ────────────────────────────────────
  if (step === 'records') {
    const record = dnsRecords[currentRecordIndex]
    const isLast = currentRecordIndex === dnsRecords.length - 1
    const typeColors: Record<string, string> = { TXT: '#a855f7', MX: '#3b82f6', CNAME: '#f59e0b' }
    const typeExplanations: Record<string, string> = {
      TXT: 'Ce record vérifie que vous êtes propriétaire du domaine ou autorise nos serveurs à envoyer en votre nom.',
      MX: 'Ce record permet de gérer les réponses à vos emails.',
      CNAME: 'Ce record active la signature DKIM pour la délivrabilité.',
    }

    if (!record) {
      setStep('verify')
      return null
    }

    return (
      <div>
        {renderProgressBar()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Ajoutez ce record DNS
          </h3>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Record {currentRecordIndex + 1}/{dnsRecords.length}
          </span>
        </div>

        <div style={{
          padding: 20, borderRadius: 12,
          border: '1px solid var(--border-primary)',
          background: 'var(--bg-elevated)',
          marginBottom: 16,
        }}>
          {/* Type badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 6, marginBottom: 16,
            background: (typeColors[record.type] ?? '#666') + '14',
            border: `1px solid ${(typeColors[record.type] ?? '#666')}30`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: typeColors[record.type] ?? '#666' }}>
              {record.type}
            </span>
          </div>

          {/* Explanation */}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', fontStyle: 'italic' }}>
            {typeExplanations[record.type] ?? ''}
          </p>

          {/* Name field */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', display: 'block', marginBottom: 4 }}>NOM</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={record.name} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, flex: 1 }} />
              <button onClick={() => copyToClipboard(record.name, `name-${currentRecordIndex}`)} style={btnSecondary}>
                {copied === `name-${currentRecordIndex}` ? <Check size={14} color="var(--color-primary)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Value field */}
          <div style={{ marginBottom: record.priority ? 14 : 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', display: 'block', marginBottom: 4 }}>VALEUR</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={record.value} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, flex: 1 }} />
              <button onClick={() => copyToClipboard(record.value, `value-${currentRecordIndex}`)} style={btnSecondary}>
                {copied === `value-${currentRecordIndex}` ? <Check size={14} color="var(--color-primary)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Priority (MX only) */}
          {record.priority && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-label)', display: 'block', marginBottom: 4 }}>PRIORITÉ</label>
              <input readOnly value={record.priority} style={{ ...inputStyle, width: 80, fontFamily: 'monospace' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {currentRecordIndex > 0 && (
            <button onClick={() => setCurrentRecordIndex(prev => prev - 1)} style={btnSecondary}>Précédent</button>
          )}
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button onClick={() => setStep('verify')} style={btnPrimary}>
              Vérifier mes DNS <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={() => setCurrentRecordIndex(prev => prev + 1)} style={btnPrimary}>
              J&apos;ai ajouté ce record <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── STEP 4: Verify ─────────────────────────────────────────────────
  if (step === 'verify') {
    const verifiedCount = dnsRecords.filter(r => r.status === 'verified').length
    const allVerified = verifiedCount === dnsRecords.length && dnsRecords.length > 0

    return (
      <div>
        {renderProgressBar()}
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Vérification en cours
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>
          La propagation DNS peut prendre de quelques minutes à 48h. Cette page se met à jour automatiquement.
        </p>

        {/* Progress */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          padding: '12px 16px', borderRadius: 10,
          background: allVerified ? 'rgba(56,161,105,0.08)' : 'rgba(59,130,246,0.08)',
          border: `1px solid ${allVerified ? 'rgba(56,161,105,0.2)' : 'rgba(59,130,246,0.2)'}`,
        }}>
          {allVerified ? (
            <CheckCircle size={18} style={{ color: '#38A169' }} />
          ) : polling ? (
            <RefreshCw size={16} style={{ color: '#3b82f6', animation: 'spin 2s linear infinite' }} />
          ) : (
            <Clock size={16} style={{ color: '#3b82f6' }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: allVerified ? '#38A169' : '#3b82f6' }}>
            {allVerified ? 'Tous les records sont vérifiés !' : `${verifiedCount}/${dnsRecords.length} records vérifiés`}
          </span>
        </div>

        {/* Records status list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {dnsRecords.map((record, i) => {
            const isVerified = record.status === 'verified'
            const isFailed = record.status === 'failed'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${isVerified ? 'rgba(56,161,105,0.3)' : isFailed ? 'rgba(239,68,68,0.3)' : 'var(--border-primary)'}`,
                background: isVerified ? 'rgba(56,161,105,0.04)' : isFailed ? 'rgba(239,68,68,0.04)' : 'transparent',
              }}>
                {isVerified ? (
                  <CheckCircle size={16} style={{ color: '#38A169', flexShrink: 0 }} />
                ) : isFailed ? (
                  <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                ) : (
                  <Loader2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, animation: 'spin 2s linear infinite' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    <span style={{ fontWeight: 700, marginRight: 6 }}>{record.type}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{record.name}</span>
                  </div>
                  {isFailed && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                      Vérifiez que la valeur est exactement identique, sans espace en trop. Si vous venez de l&apos;ajouter, attendez quelques minutes.
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                  color: isVerified ? '#38A169' : isFailed ? '#ef4444' : 'var(--text-muted)',
                  background: isVerified ? 'rgba(56,161,105,0.12)' : isFailed ? 'rgba(239,68,68,0.12)' : 'var(--bg-hover)',
                }}>
                  {isVerified ? 'Vérifié' : isFailed ? 'Échoué' : 'En attente'}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setCurrentRecordIndex(0); setStep('records') }} style={btnSecondary}>
            Revoir les records
          </button>
          <button onClick={handleVerify} disabled={polling} style={{ ...btnSecondary, opacity: polling ? 0.5 : 1 }}>
            <RefreshCw size={14} /> Vérifier maintenant
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={handleDelete} style={{ ...btnSecondary, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>
    )
  }

  // ─── DONE: Verified ─────────────────────────────────────────────────
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
        padding: '16px 20px', borderRadius: 12,
        background: 'rgba(56,161,105,0.06)', border: '1px solid rgba(56,161,105,0.2)',
      }}>
        <CheckCircle size={22} style={{ color: '#38A169', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#38A169' }}>Domaine vérifié</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{domainData?.domain}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={handleDelete} style={{ ...btnSecondary, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', padding: '6px 14px', fontSize: 12 }}>
          <Trash2 size={13} /> Déconnecter
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Nom affiché
          </label>
          <input
            type="text"
            value={fromName}
            onChange={e => setFromName(e.target.value)}
            placeholder="Mon Coaching"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
            Adresse d&apos;envoi
          </label>
          <input
            type="email"
            value={fromEmail}
            onChange={e => setFromEmail(e.target.value)}
            placeholder={`contact@${domainData?.domain ?? 'mondomaine.fr'}`}
            style={inputStyle}
          />
        </div>
        <button onClick={handleSaveFrom} disabled={savingFrom} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: savingFrom ? 0.5 : 1 }}>
          {savingFrom ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or errors only if EmailDomain type needs `dns_records` typed differently — fix if needed)

- [ ] **Step 3: Commit**

```bash
git add src/components/emails/DomainWizard.tsx
git commit -m "feat: DomainWizard component — 4-step DNS setup wizard"
```

---

### Task 2: Wire DomainWizard into emails page

**Files:**
- Modify: `src/app/(dashboard)/acquisition/emails/page.tsx`

- [ ] **Step 1: Replace DomainSetup import with DomainWizard**

Find the import line:
```typescript
import DomainSetup from '@/components/emails/DomainSetup'
```
Replace with:
```typescript
import DomainWizard from '@/components/emails/DomainWizard'
```

- [ ] **Step 2: Update the Paramètres tab rendering**

Find where `<DomainSetup />` is rendered (around line 331 in the ParametresTab). The current code renders DomainSetup without props. Replace with:

```tsx
<DomainWizard
  existingDomain={domains[0] ?? null}
  onDomainChange={fetchDomains}
/>
```

Check how `domains` and `fetchDomains` are defined in the file. The `domains` array is already fetched via a `useEffect` that calls `/api/emails/domains`. The `fetchDomains` function should already exist. If `domains` is not accessible in the ParametresTab scope, you may need to pass it as a prop or read it from the parent component's state.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/acquisition/emails/page.tsx"
git commit -m "feat: wire DomainWizard into emails page"
```

---

### Task 3: Cron — background DNS verification polling

**Files:**
- Modify: `src/app/api/cron/workflow-scheduler/route.ts`

- [ ] **Step 1: Add counter to results object**

Add after `calendar_reminders_sent: 0,`:
```typescript
    email_domains_verified: 0,
```

- [ ] **Step 2: Add import**

Add at top (if not already imported):
```typescript
import { verifyDomain } from '@/lib/email/domains'
```

- [ ] **Step 3: Add the DNS polling block**

Before the final `} catch (err) {` (the global catch), add:

```typescript
    // ─── 7. Background DNS verification for pending email domains ─────
    {
      const { data: pendingDomains } = await supabase
        .from('email_domains')
        .select('id, resend_domain_id, status')
        .eq('status', 'pending')

      if (pendingDomains) {
        for (const domain of pendingDomains) {
          try {
            if (!domain.resend_domain_id) continue

            const result = await verifyDomain(domain.resend_domain_id)
            if (!result.ok || !result.domain) continue

            const resendDomain = result.domain
            const newStatus = resendDomain.status === 'verified' ? 'verified'
              : resendDomain.status === 'failed' ? 'failed'
              : 'pending'

            const dnsRecords = (resendDomain.records ?? []).map((r: { type: string; name: string; value: string; priority?: number; status: string }) => ({
              type: r.type,
              name: r.name,
              value: r.value,
              priority: r.priority ?? null,
              status: r.status,
            }))

            await supabase
              .from('email_domains')
              .update({ status: newStatus, dns_records: dnsRecords })
              .eq('id', domain.id)

            if (newStatus === 'verified') results.email_domains_verified++
          } catch (err) {
            results.errors.push(`Email domain ${domain.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
          }
        }
      }
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/workflow-scheduler/route.ts
git commit -m "feat: background DNS verification polling in cron"
```

---

### Task 4: Delete old DomainSetup component

**Files:**
- Delete: `src/components/emails/DomainSetup.tsx`

- [ ] **Step 1: Verify DomainSetup is no longer imported anywhere**

Run: `grep -r "DomainSetup" src/ --include="*.tsx" --include="*.ts"`
Expected: No results (all references should have been replaced in Task 2)

- [ ] **Step 2: Delete the file**

```bash
rm src/components/emails/DomainSetup.tsx
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old DomainSetup component (replaced by DomainWizard)"
```

---

### Task 5: Manual E2E verification

- [ ] **Step 1: Test fresh domain setup**

Go to Emails > Paramètres. Verify wizard shows step 1 (domain input). Enter a test domain. Verify:
- Progress bar shows 4 steps
- Step 2 shows cleanup checklist with registrar links
- Step 3 shows records one by one with copy buttons
- Step 4 shows live polling with per-record status

- [ ] **Step 2: Test resume**

Refresh the page while on step 4 (pending domain). Verify it resumes at the verification step.

- [ ] **Step 3: Test verified state**

If domain gets verified, verify:
- Shows green "Domaine vérifié" card
- From name/email inputs work
- Save button works

- [ ] **Step 4: Test delete**

Click "Déconnecter". Verify wizard resets to step 1.
