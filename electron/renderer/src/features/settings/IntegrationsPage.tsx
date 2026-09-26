// Paramètres › Intégrations — port of src/app/(dashboard)/parametres/integrations
// (meta-card, google-card, youtube-card, DomainWizardCard, SuppressionList,
// telegram-card, apify-card, placeholders WhatsApp/Stripe). OAuth flows
// (Meta, Google, YouTube) and Meta Pixel/CAPI settings open the web page —
// the OAuth start routes rely on the browser session cookie. Everything else
// is native: GET /api/integrations, POST /api/integrations (telegram/apify
// credentials), DELETE /api/integrations/:type, POST
// /api/integrations/meta/disconnect, GET/DELETE /api/integrations/youtube,
// GET/DELETE /api/google-calendar-accounts, /api/emails/domains (+verify),
// /api/emails/suppressions, POST /api/notifications/telegram.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Input } from '../../design-system/Input'
import { TableCard } from '../../design-system/TableCard'
import { LoadingState, ErrorState } from '../../design-system/States'
import { ConfirmButton, Field, NoticeBanner, useNotice } from '../social/ui'
import { errMsg } from '../social/http'
import '../social/social.css'
import '../../design-system/status-pill.css'

type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

interface IntegrationRow {
  id: string | null
  type: string
  is_active: boolean
  connected_at: string | null
}
interface GoogleAccount {
  id: string
  email: string
  label: string | null
  color: string
  is_active: boolean
  connected_at: string
}
interface EmailDomain {
  id: string
  domain: string
  status: 'pending' | 'verified' | 'failed'
  dns_records: { type: string; name: string; value: string; priority?: number; status: string }[] | null
  default_from_email: string | null
  default_from_name: string | null
}
interface Suppression {
  id: string
  email: string
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe'
  created_at: string
}

function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <span
      className="ds-status-pill"
      style={connected ? { color: 'var(--color-success)', background: 'var(--color-success-soft)' } : { color: 'var(--color-text-tertiary)', background: 'var(--color-bg-muted)' }}
    >
      {label ?? (connected ? 'Connecté' : 'Non connecté')}
    </span>
  )
}

function Card({ name, description, badge, children }: { name: string; description: string; badge: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="soc-card">
      <div className="soc-card-head">
        <div>
          <h2 className="soc-card-title">{name}</h2>
          <p className="soc-card-sub">{description}</p>
        </div>
        {badge}
      </div>
      {children}
    </section>
  )
}

function since(iso: string | null): string {
  return iso ? `Connecté le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''
}

export function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>([])
  const [youtube, setYoutube] = useState<IntegrationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, notify, clearNotice] = useNotice()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [r, yt] = await Promise.all([
        api.get<{ data: IntegrationRow[] }>('/api/integrations'),
        api.get<{ data: IntegrationRow | null }>('/api/integrations/youtube').catch(() => ({ data: null })),
      ])
      setRows(r.data ?? [])
      setYoutube(yt.data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const get = (type: string) => rows.find((r) => r.type === type)

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      notify(ok)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const meta = get('meta')
  const metaOn = !!meta?.is_active
  const ytOn = !!youtube?.is_active

  return (
    <div className="soc-page">
      <header className="soc-header">
        <div>
          <h1>Intégrations</h1>
          <p>Connecte tes outils pour automatiser l'acquisition et le suivi des leads.</p>
        </div>
        <button type="button" className="ds-pill-button" onClick={() => void load()}>
          Actualiser
        </button>
      </header>
      <NoticeBanner notice={notice} onClose={clearNotice} />
      <div className="soc-banner soc-banner--info">
        Les connexions OAuth (Meta, Google, YouTube) s'ouvrent dans votre navigateur. Revenez ici puis cliquez « Actualiser ».
      </div>

      <div className="soc-grid-2">
        <Card name="Facebook Meta Ads + Instagram" description="Import automatique des leads Ads, DMs & stats Instagram." badge={<StatusBadge connected={metaOn} />}>
          {metaOn && <span className="soc-muted">{since(meta?.connected_at ?? null)}</span>}
          <div className="soc-row">
            {metaOn ? (
              <>
                <button type="button" className="ds-pill-button" onClick={() => void openWeb('/parametres/integrations')}>
                  Pixel & CAPI ↗
                </button>
                <ConfirmButton label="Déconnecter" onConfirm={() => void run(() => api.post('/api/integrations/meta/disconnect', {}), 'Meta déconnecté')} />
              </>
            ) : (
              <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/parametres/integrations')}>
                Connecter Meta ↗
              </button>
            )}
          </div>
        </Card>

        <GoogleCard notify={notify} />

        <Card name="YouTube" description="Vidéos, analytics, commentaires et publication (longues + Shorts)." badge={<StatusBadge connected={ytOn} />}>
          {ytOn && <span className="soc-muted">{since(youtube?.connected_at ?? null)}</span>}
          <div className="soc-row">
            {ytOn ? (
              <ConfirmButton label="Déconnecter" onConfirm={() => void run(() => api.delete('/api/integrations/youtube'), 'YouTube déconnecté')} />
            ) : (
              <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/api/integrations/youtube/authorize')}>
                Connecter YouTube ↗
              </button>
            )}
          </div>
        </Card>

        <CredentialsCard
          type="telegram"
          name="Telegram"
          description="Notifications coach (nouveaux leads, RDV…)."
          row={get('telegram')}
          fields={[
            { key: 'botToken', label: 'Bot token', placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz', secret: true },
            { key: 'chatId', label: 'Chat ID', placeholder: '123456789' },
          ]}
          help="Token : créez un bot via @BotFather (/newbot). Chat ID : envoyez un message à votre bot puis utilisez @userinfobot."
          notify={notify}
          onChanged={() => void load()}
          extra={
            <button
              type="button"
              className="ds-pill-button"
              onClick={() => void run(() => api.post('/api/notifications/telegram', { message: '✅ Test ClosRM — Telegram est bien connecté !' }), 'Message de test envoyé')}
            >
              Envoyer un test
            </button>
          }
        />

        <CredentialsCard
          type="apify"
          name="Apify"
          description="Suivi des likes Instagram (scraper de likers)."
          row={get('apify')}
          fields={[
            { key: 'apiToken', label: 'API token', placeholder: 'apify_api_...', secret: true },
            { key: 'actorId', label: 'Actor ID', placeholder: 'instaprism~instagram-likers-scraper' },
          ]}
          help="Token : console.apify.com › Settings › Integrations. Actor : l'identifiant de l'acteur « likers scraper »."
          notify={notify}
          onChanged={() => void load()}
        />

        <Card name="WhatsApp Business" description="Messages automatiques aux leads et rappels RDV" badge={<StatusBadge connected={false} label="Bientôt" />} />
        <Card name="Stripe" description="Suivi paiements et abonnements — V2" badge={<StatusBadge connected={false} label="Bientôt" />} />
      </div>

      <DomainCard notify={notify} />
      <SuppressionList notify={notify} />
    </div>
  )
}

function GoogleCard({ notify }: { notify: Notify }) {
  const [accounts, setAccounts] = useState<GoogleAccount[] | null>(null)
  const load = useCallback(() => {
    api
      .get<{ data: GoogleAccount[] }>('/api/google-calendar-accounts')
      .then((r) => setAccounts(r.data ?? []))
      .catch((e) => {
        setAccounts([])
        notify(errMsg(e), 'danger')
      })
  }, [notify])
  useEffect(load, [load])

  return (
    <Card
      name="Google Agenda"
      description="Sync des RDV (multi-comptes)."
      badge={<StatusBadge connected={(accounts ?? []).some((a) => a.is_active)} label={accounts && accounts.length > 0 ? `${accounts.length} compte${accounts.length > 1 ? 's' : ''}` : undefined} />}
    >
      {accounts === null ? (
        <LoadingState />
      ) : (
        accounts.map((a) => (
          <div key={a.id} className="soc-row" style={{ flexWrap: 'nowrap' }}>
            <span className="soc-dot" style={{ background: a.color }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{a.label || a.email}</div>
              <div className="soc-muted" style={{ fontSize: 11 }}>
                {a.email} · {a.is_active ? 'actif' : 'inactif'}
              </div>
            </div>
            <ConfirmButton
              label="Déconnecter"
              onConfirm={async () => {
                try {
                  await api.delete(`/api/google-calendar-accounts/${a.id}`)
                  load()
                } catch (e) {
                  notify(errMsg(e), 'danger')
                }
              }}
            />
          </div>
        ))
      )}
      <button type="button" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} onClick={() => void openWeb('/api/integrations/google/authorize')}>
        {accounts && accounts.length > 0 ? '+ Ajouter un compte ↗' : 'Connecter Google ↗'}
      </button>
    </Card>
  )
}

function CredentialsCard({
  type,
  name,
  description,
  row,
  fields,
  help,
  notify,
  onChanged,
  extra,
}: {
  type: 'telegram' | 'apify'
  name: string
  description: string
  row: IntegrationRow | undefined
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[]
  help: string
  notify: Notify
  onChanged: () => void
  extra?: React.ReactNode
}) {
  const connected = !!row?.is_active
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function connect() {
    if (fields.some((f) => !values[f.key]?.trim())) return
    setBusy(true)
    try {
      await api.post('/api/integrations', { type, credentials: Object.fromEntries(fields.map((f) => [f.key, values[f.key].trim()])) })
      setOpen(false)
      setValues({})
      notify(`${name} connecté`)
      onChanged()
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    try {
      await api.delete(`/api/integrations/${type}`)
      notify(`${name} déconnecté`)
      onChanged()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  return (
    <Card name={name} description={description} badge={<StatusBadge connected={connected} />}>
      {connected && <span className="soc-muted">{since(row?.connected_at ?? null)}</span>}
      {open && (
        <div className="soc-stack">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input type={f.secret ? 'password' : 'text'} value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            </Field>
          ))}
          <span className="soc-muted" style={{ fontSize: 11 }}>{help}</span>
        </div>
      )}
      <div className="soc-row">
        {open ? (
          <>
            <button type="button" className="ds-pill-button" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={busy || fields.some((f) => !values[f.key]?.trim())} onClick={() => void connect()}>
              {busy ? 'Connexion…' : connected ? 'Mettre à jour' : 'Connecter'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`ds-pill-button ${connected ? '' : 'ds-pill-button--dark'}`} onClick={() => setOpen(true)}>
              {connected ? 'Modifier les identifiants' : 'Connecter'}
            </button>
            {connected && extra}
            {connected && <ConfirmButton label="Déconnecter" onConfirm={() => void disconnect()} />}
          </>
        )}
      </div>
    </Card>
  )
}

function DomainCard({ notify }: { notify: Notify }) {
  const [domains, setDomains] = useState<EmailDomain[] | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await api.get<EmailDomain[] | { data: EmailDomain[] }>('/api/emails/domains')
      const list = Array.isArray(r) ? r : (r.data ?? [])
      setDomains(list)
      const d = list[0]
      if (d) {
        setFromEmail(d.default_from_email ?? `contact@${d.domain}`)
        setFromName(d.default_from_name ?? '')
      }
    } catch (e) {
      setDomains([])
      notify(errMsg(e), 'danger')
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    try {
      await fn()
      if (ok) notify(ok)
      await load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const domain = domains?.[0]

  return (
    <section className="soc-card">
      <div className="soc-card-head">
        <div>
          <h2 className="soc-card-title">Domaine email</h2>
          <p className="soc-card-sub">Envoyez vos emails depuis votre propre domaine (DNS vérifiés via Resend).</p>
        </div>
        {domain && <StatusBadge connected={domain.status === 'verified'} label={domain.status === 'verified' ? 'Vérifié' : domain.status === 'failed' ? 'Échec' : 'En attente DNS'} />}
      </div>
      {domains === null ? (
        <LoadingState />
      ) : !domain ? (
        <div className="soc-row">
          <div style={{ width: 280 }}>
            <Input value={newDomain} placeholder="moncoaching.fr" onChange={(e) => setNewDomain(e.target.value)} />
          </div>
          <button
            type="button"
            className="ds-pill-button ds-pill-button--dark"
            disabled={busy || !newDomain.trim()}
            onClick={() => void act(() => api.post('/api/emails/domains', { domain: newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') }), 'Domaine ajouté — configure les DNS')}
          >
            Ajouter le domaine
          </button>
        </div>
      ) : (
        <div className="soc-stack">
          <strong>{domain.domain}</strong>
          {domain.status !== 'verified' && (domain.dns_records ?? []).length > 0 && (
            <TableCard title="Enregistrements DNS à ajouter" subtitle="Chez votre registrar (OVH, GoDaddy, Cloudflare…)">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Nom</th>
                    <th>Valeur</th>
                    <th>Priorité</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(domain.dns_records ?? []).map((r, i) => (
                    <tr key={i}>
                      <td className="ds-num">{r.type}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 320, wordBreak: 'break-all' }}>
                        {r.value}{' '}
                        <button type="button" className="soc-link-btn" onClick={() => void navigator.clipboard.writeText(r.value)}>
                          Copier
                        </button>
                      </td>
                      <td className="ds-num">{r.priority ?? '—'}</td>
                      <td className="ds-muted">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          )}
          {domain.status !== 'verified' && (
            <button type="button" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void act(() => api.post(`/api/emails/domains/${domain.id}/verify`, {}), 'Vérification lancée')}>
              {busy ? 'Vérification…' : 'Vérifier les DNS'}
            </button>
          )}
          {domain.status === 'verified' && (
            <div className="soc-row" style={{ alignItems: 'flex-end' }}>
              <div style={{ width: 260 }}>
                <Field label="Email d'expédition">
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
                </Field>
              </div>
              <div style={{ width: 220 }}>
                <Field label="Nom d'expéditeur">
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
                </Field>
              </div>
              <button
                type="button"
                className="ds-pill-button ds-pill-button--dark"
                disabled={busy || !fromEmail.trim()}
                onClick={() => void act(() => api.patch(`/api/emails/domains/${domain.id}`, { default_from_email: fromEmail.trim(), default_from_name: fromName.trim() }), 'Expéditeur enregistré')}
              >
                Enregistrer
              </button>
            </div>
          )}
          <ConfirmButton label="Supprimer le domaine" onConfirm={() => void act(() => api.delete(`/api/emails/domains/${domain.id}`), 'Domaine supprimé')} />
        </div>
      )}
    </section>
  )
}

const REASON_LABEL: Record<Suppression['reason'], string> = { bounce: 'Rebond', complaint: 'Plainte', unsubscribe: 'Désabonné', manual: 'Ajout manuel' }

function SuppressionList({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<Suppression[] | null>(null)
  const load = useCallback(async () => {
    try {
      const r = await api.get<Suppression[] | { data: Suppression[] }>('/api/emails/suppressions')
      setItems(Array.isArray(r) ? r : (r.data ?? []))
    } catch (e) {
      setItems([])
      notify(errMsg(e), 'danger')
    }
  }, [notify])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <TableCard
      title="Liste de suppression emails"
      subtitle="Adresses bloquées (rebonds, plaintes, désabonnements) — plus aucun email ne leur est envoyé."
      toolbar={
        <button type="button" className="ds-pill-button" onClick={() => void load()}>
          Actualiser
        </button>
      }
    >
      {items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <p className="soc-muted" style={{ padding: 16 }}>Aucune adresse bloquée.</p>
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Raison</th>
              <th className="ds-num-cell">Date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td className="ds-muted">{REASON_LABEL[s.reason] ?? s.reason}</td>
                <td className="ds-num-cell"><span className="ds-num">{new Date(s.created_at).toLocaleDateString('fr-FR')}</span></td>
                <td>
                  <ConfirmButton
                    label="Débloquer"
                    confirmLabel="Débloquer ?"
                    onConfirm={async () => {
                      try {
                        await api.delete(`/api/emails/suppressions/${s.id}`)
                        setItems((prev) => (prev ?? []).filter((x) => x.id !== s.id))
                      } catch (e) {
                        notify(errMsg(e), 'danger')
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}
