// Emails > Paramètres — native port of the web DomainWizard
// (src/components/emails/DomainWizard.tsx). Routes: POST /api/emails/domains,
// POST /api/emails/domains/:id/verify, PATCH/DELETE /api/emails/domains/:id.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api-client'
import { Button } from '../../../design-system/Button'
import { Input } from '../../../design-system/Input'
import { StatusPill } from '../../../design-system/StatusPill'
import { apiPostEmpty, errorMessage } from '../http'
import type { EmailDomain } from '../types'

type Step = 'domain' | 'cleanup' | 'records' | 'verify' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'domain', label: '1. Domaine' },
  { key: 'cleanup', label: '2. Nettoyage' },
  { key: 'records', label: '3. Records DNS' },
  { key: 'verify', label: '4. Vérification' },
]

const HOSTS = [
  { name: 'OVH', url: 'https://www.ovh.com/manager/' },
  { name: 'Namecheap', url: 'https://ap.www.namecheap.com/' },
  { name: 'GoDaddy', url: 'https://dcc.godaddy.com/' },
  { name: 'Ionos', url: 'https://my.ionos.fr/' },
  { name: 'Hostinger', url: 'https://hpanel.hostinger.com/' },
]

const TYPE_HELP: Record<string, string> = {
  TXT: 'Ce record vérifie que vous êtes propriétaire du domaine ou autorise nos serveurs à envoyer en votre nom.',
  MX: 'Ce record permet de gérer les réponses à vos emails.',
  CNAME: 'Ce record active la signature DKIM pour la délivrabilité.',
}

function openExternal(url: string) {
  if (window.closrm?.openExternal) window.closrm.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

function initialStep(d: EmailDomain | null): Step {
  if (!d) return 'domain'
  return d.status === 'verified' ? 'done' : 'verify'
}

export function DomainSettings({ existing, onChange }: { existing: EmailDomain | null; onChange: () => void }) {
  const [step, setStep] = useState<Step>(initialStep(existing))
  const [domain, setDomain] = useState(existing?.domain ?? '')
  const [data, setData] = useState<EmailDomain | null>(existing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState({ mx: false, spf: false, dkim: false })
  const [recordIndex, setRecordIndex] = useState(0)
  const [polling, setPolling] = useState(false)
  const [fromEmail, setFromEmail] = useState(existing?.default_from_email ?? '')
  const [fromName, setFromName] = useState(existing?.default_from_name ?? '')
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    setData(existing)
    setDomain(existing.domain)
    setFromEmail(existing.default_from_email ?? '')
    setFromName(existing.default_from_name ?? '')
    setStep(initialStep(existing))
  }, [existing])

  const records = data?.dns_records ?? []

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function addDomain() {
    let clean = domain.trim().toLowerCase()
    if (!clean) return
    if (clean.includes('@')) clean = clean.split('@').pop() ?? clean
    setDomain(clean)
    setLoading(true)
    setError(null)
    try {
      const json = await api.post<EmailDomain | { data: EmailDomain }>('/api/emails/domains', { domain: clean })
      const payload = 'data' in json ? json.data : json
      setData(payload)
      setStep('cleanup')
      onChange()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const verify = useCallback(async () => {
    if (!data) return
    setPolling(true)
    try {
      const json = await apiPostEmpty<EmailDomain | { data: EmailDomain }>(`/api/emails/domains/${data.id}/verify`)
      const payload = 'data' in json ? json.data : json
      setData(payload)
      if (payload.status === 'verified') {
        setStep('done')
        setFromEmail(payload.default_from_email ?? `contact@${payload.domain}`)
        setFromName(payload.default_from_name ?? '')
        onChange()
      }
    } catch {
      // retried by the interval
    } finally {
      setPolling(false)
    }
  }, [data, onChange])

  useEffect(() => {
    if (step !== 'verify' || !data) return
    verify()
    const id = setInterval(verify, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data?.id])

  async function saveFrom() {
    if (!data) return
    setSaveStatus(null)
    const email = fromEmail.trim().toLowerCase()
    if (email && !email.endsWith(`@${data.domain}`)) {
      setSaveStatus({ ok: false, message: `L'adresse doit se terminer par @${data.domain}` })
      return
    }
    try {
      await api.patch(`/api/emails/domains/${data.id}`, { default_from_email: email, default_from_name: fromName })
      setSaveStatus({ ok: true, message: "Adresse d'envoi enregistrée" })
      onChange()
    } catch (err) {
      setSaveStatus({ ok: false, message: errorMessage(err) })
    }
  }

  async function remove() {
    if (!data) return
    if (!confirm('Supprimer ce domaine ? Cette action est irréversible.')) return
    await api.delete(`/api/emails/domains/${data.id}`).catch(() => undefined)
    setData(null)
    setDomain('')
    setStep('domain')
    setChecks({ mx: false, spf: false, dkim: false })
    setRecordIndex(0)
    onChange()
  }

  const progress = step !== 'done' && (
    <div className="mk-toolbar">
      {STEPS.map((s) => (
        <span key={s.key} className={`mk-toggle-chip ${s.key === step ? 'mk-toggle-chip--on' : ''}`}>
          {s.label}
        </span>
      ))}
    </div>
  )

  return (
    <div className="mk-card">
      <div>
        <h2 className="mk-section-title">Domaine d'envoi</h2>
        <p className="mk-section-sub">Configure ton domaine pour envoyer des emails depuis ta propre adresse</p>
      </div>
      {progress}

      {step === 'domain' && (
        <div className="mk-form">
          <div className="mk-form-row">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="moncoaching.fr" onKeyDown={(e) => e.key === 'Enter' && addDomain()} />
            <Button variant="primary" disabled={loading || !domain.trim()} onClick={addDomain} style={{ flex: 'none' }}>
              {loading ? 'Ajout…' : 'Continuer'}
            </Button>
          </div>
          {error && <p className="lead-create-error">{error}</p>}
          <p className="ds-muted">
            Utilisez votre domaine principal (ex : moncoaching.fr). Les réponses de vos leads seront reçues sur le sous-domaine reply.
            {domain.trim() || 'moncoaching.fr'}, pour ne pas interférer avec votre boîte mail existante.
          </p>
        </div>
      )}

      {step === 'cleanup' && (
        <div className="mk-form">
          <p className="ds-muted">
            Avant d'ajouter les nouveaux records, supprimez les anciens pour éviter les conflits. Si vous n'en avez pas, cochez quand même pour
            continuer.
          </p>
          {[
            {
              key: 'mx' as const,
              label: `Records MX existants sur reply.${data?.domain ?? 'votredomaine'}`,
              desc: 'Uniquement sur le sous-domaine reply. Ne touchez PAS aux MX de votre domaine racine (votre boîte mail pro).',
            },
            {
              key: 'spf' as const,
              label: "Records TXT (SPF) contenant d'autres services",
              desc: "Si vous avez déjà un SPF (ex : v=spf1 include:_spf.mail.ovh.net), on va le remplacer par celui d'Amazon SES.",
            },
            {
              key: 'dkim' as const,
              label: 'Anciens records CNAME (DKIM)',
              desc: "Supprimez les CNAME DKIM d'anciens services (Mailgun, Sendgrid, Resend, GoHighLevel…).",
            },
          ].map((item) => (
            <label key={item.key} className="mk-check">
              <input type="checkbox" checked={checks[item.key]} onChange={(e) => setChecks((c) => ({ ...c, [item.key]: e.target.checked }))} />
              <span>
                {item.label}
                <small>{item.desc}</small>
              </span>
            </label>
          ))}
          <span className="mk-label">Guides par hébergeur</span>
          <div className="mk-toolbar">
            {HOSTS.map((h) => (
              <button key={h.name} className="mk-action" onClick={() => openExternal(h.url)}>
                {h.name} ↗
              </button>
            ))}
          </div>
          <div className="lead-create-actions">
            <Button variant="ghost" onClick={() => setStep('domain')}>
              Retour
            </Button>
            <Button variant="primary" disabled={!(checks.mx || checks.spf || checks.dkim)} onClick={() => setStep('records')}>
              C'est fait, continuer
            </Button>
          </div>
        </div>
      )}

      {step === 'records' &&
        (records[recordIndex] ? (
          <div className="mk-form">
            <div className="mk-pick-title">
              <span>Ajoutez ce record DNS</span>
              <span className="ds-muted">
                Record {recordIndex + 1}/{records.length}
              </span>
            </div>
            <div className="mk-dns-record">
              <strong>{records[recordIndex].type}</strong>
              <span className="ds-muted">{TYPE_HELP[records[recordIndex].type] ?? ''}</span>
              <span className="mk-label">NOM</span>
              <div className="mk-copy-row">
                <Input readOnly value={records[recordIndex].name} />
                <button className="mk-action" onClick={() => copy(records[recordIndex].name, `n${recordIndex}`)}>
                  {copied === `n${recordIndex}` ? 'Copié' : 'Copier'}
                </button>
              </div>
              <span className="mk-label">VALEUR</span>
              <div className="mk-copy-row">
                <Input readOnly value={records[recordIndex].value} />
                <button className="mk-action" onClick={() => copy(records[recordIndex].value, `v${recordIndex}`)}>
                  {copied === `v${recordIndex}` ? 'Copié' : 'Copier'}
                </button>
              </div>
              {records[recordIndex].priority != null && (
                <>
                  <span className="mk-label">PRIORITÉ</span>
                  <span className="ds-num">{records[recordIndex].priority}</span>
                </>
              )}
            </div>
            <div className="lead-create-actions">
              {recordIndex > 0 && (
                <Button variant="ghost" onClick={() => setRecordIndex((i) => i - 1)}>
                  Précédent
                </Button>
              )}
              {recordIndex === records.length - 1 ? (
                <Button variant="primary" onClick={() => setStep('verify')}>
                  Vérifier mes DNS
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setRecordIndex((i) => i + 1)}>
                  J'ai ajouté ce record
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mk-form">
            <p className="ds-muted">Aucun record DNS à ajouter.</p>
            <Button variant="primary" onClick={() => setStep('verify')}>
              Vérifier mes DNS
            </Button>
          </div>
        ))}

      {step === 'verify' && (
        <div className="mk-form">
          <p className="ds-muted">
            Nous vérifions que les records DNS ont bien été ajoutés chez votre hébergeur. La propagation peut prendre de quelques minutes à 48h.
            Vérification automatique toutes les 30 secondes.
          </p>
          <div className={`mk-banner ${records.length > 0 && records.every((r) => r.status === 'verified') ? 'mk-banner--success' : ''}`}>
            <span>
              {polling ? 'Vérification en cours… · ' : ''}
              {records.filter((r) => r.status === 'verified').length}/{records.length} records vérifiés
            </span>
          </div>
          {records.map((r, i) => (
            <div key={i} className="mk-dns-record">
              <div className="mk-pick-title">
                <span>
                  {r.type} <span className="ds-muted">{r.name}</span>
                </span>
                <StatusPill
                  {...(r.status === 'verified'
                    ? { label: 'Vérifié', color: 'var(--color-success)', bg: 'var(--color-success-soft)' }
                    : r.status === 'failed'
                      ? { label: 'Échoué', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' }
                      : { label: 'En attente', color: 'var(--color-text-tertiary)', bg: 'var(--color-bg-muted)' })}
                />
              </div>
              {r.status === 'failed' && <span className="lead-create-error">Vérifiez que la valeur est exactement identique, sans espace en trop.</span>}
            </div>
          ))}
          <div className="lead-create-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setRecordIndex(0)
                setStep('records')
              }}
            >
              Revoir les records
            </Button>
            <Button variant="secondary" disabled={polling} onClick={verify}>
              Vérifier maintenant
            </Button>
            <button className="mk-action mk-action--danger" onClick={remove}>
              Supprimer
            </button>
          </div>
        </div>
      )}

      {step === 'done' && data && (
        <div className="mk-form">
          <div className="mk-banner mk-banner--success">
            <span>Domaine vérifié · {data.domain}</span>
            <button className="mk-action mk-action--danger" onClick={remove}>
              Déconnecter
            </button>
          </div>
          <div className="mk-field">
            <label>Nom affiché</label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Mon Coaching" />
          </div>
          <div className="mk-field">
            <label>Adresse d'envoi</label>
            <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder={`contact@${data.domain}`} />
          </div>
          <div className="lead-create-actions">
            <Button variant="primary" onClick={saveFrom}>
              Enregistrer
            </Button>
            {saveStatus && <span className={saveStatus.ok ? 'ds-muted' : 'lead-create-error'}>{saveStatus.message}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
