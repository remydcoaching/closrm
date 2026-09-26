// Paramètres › Compte — port of src/app/(dashboard)/parametres/reglages
// (PlanOverview, ProfileForm, WorkspaceForm, BrandingForm, LabelsEditor ×2,
// slug public, DeleteAccount). Endpoints: GET /api/billing/plan,
// GET/PATCH /api/user/profile, POST /api/user/avatar (multipart),
// PATCH /api/workspaces, POST/DELETE /api/workspaces/logo,
// GET/PATCH /api/workspace/config, GET/PUT /api/workspaces/slug,
// DELETE /api/user/account.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { webUrl } from '../../lib/web-link'
import { Avatar } from '../../design-system/Avatar'
import { Input } from '../../design-system/Input'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { ErrorState, LoadingState } from '../../design-system/States'
import { Field, NoticeBanner, useNotice } from '../social/ui'
import { errMsg, http } from '../social/http'
import { hexToRgba } from '../social/social-utils'
import '../social/social.css'

interface UserData {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}
interface WorkspaceData {
  id: string
  name: string
  timezone: string
  accent_color: string | null
  logo_url: string | null
}
interface LabelEntry {
  key: string
  label: string
  color: string
  bg: string
  visible: boolean
}
interface PlanData {
  workspace: {
    subscription_status: string | null
    trial_ends_at: string | null
    current_period_end: string | null
    is_internal: boolean
    seats_count: number | null
    wallet_balance_cents: number | null
    wallet_auto_recharge_enabled: boolean | null
    wallet_auto_recharge_amount_cents: number | null
  }
  plan: {
    name: string
    base_price_cents: number
    additional_seat_price_cents: number
    max_seats: number | null
    overage_email_price_cents_per_1k: number
  } | null
  quotas: { resource_type: string; quota_total: number; quota_used: number; fair_use_cap: number | null }[]
}

const TIMEZONES = [
  ['Europe/Paris', 'Europe/Paris (GMT+1/+2)'],
  ['Europe/London', 'Europe/London (GMT+0/+1)'],
  ['Europe/Berlin', 'Europe/Berlin (GMT+1/+2)'],
  ['Europe/Brussels', 'Europe/Brussels (GMT+1/+2)'],
  ['Europe/Zurich', 'Europe/Zurich (GMT+1/+2)'],
  ['Europe/Rome', 'Europe/Rome (GMT+1/+2)'],
  ['Europe/Madrid', 'Europe/Madrid (GMT+1/+2)'],
  ['Europe/Lisbon', 'Europe/Lisbon (GMT+0/+1)'],
  ['America/New_York', 'America/New York (GMT-5/-4)'],
  ['America/Chicago', 'America/Chicago (GMT-6/-5)'],
  ['America/Los_Angeles', 'America/Los Angeles (GMT-8/-7)'],
  ['America/Toronto', 'America/Toronto (GMT-5/-4)'],
  ['America/Montreal', 'America/Montréal (GMT-5/-4)'],
  ['Africa/Casablanca', 'Africa/Casablanca (GMT+0/+1)'],
  ['Africa/Tunis', 'Africa/Tunis (GMT+1)'],
  ['Africa/Abidjan', 'Africa/Abidjan (GMT+0)'],
  ['Africa/Dakar', 'Africa/Dakar (GMT+0)'],
  ['Indian/Reunion', 'Indian/Réunion (GMT+4)'],
  ['Pacific/Tahiti', 'Pacific/Tahiti (GMT-10)'],
  ['America/Guadeloupe', 'America/Guadeloupe (GMT-4)'],
  ['America/Martinique', 'America/Martinique (GMT-4)'],
  ['America/Cayenne', 'America/Cayenne (GMT-3)'],
] as const

const RESOURCE_LABEL: Record<string, string> = { email: 'Emails', ai_tokens: 'Tokens IA', whatsapp: 'WhatsApp', sms: 'SMS' }

// Same defaults as src/lib/workspace/status-defaults.ts / source-defaults.ts (used for per-row reset).
const DEFAULT_STATUS: LabelEntry[] = [
  { key: 'nouveau', label: 'Nouveau', color: '#a0a0a0', bg: 'rgba(160,160,160,0.12)', visible: true },
  { key: 'scripte', label: 'Scripté', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', visible: true },
  { key: 'setting_planifie', label: 'Setting planifié', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', visible: true },
  { key: 'no_show_setting', label: 'No-show Setting', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', visible: true },
  { key: 'closing_planifie', label: 'Closing planifié', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', visible: true },
  { key: 'no_show_closing', label: 'No-show Closing', color: '#f97316', bg: 'rgba(249,115,22,0.12)', visible: true },
  { key: 'clos', label: 'Closé ✅', color: 'var(--color-primary)', bg: 'rgba(0,200,83,0.12)', visible: true },
  { key: 'pas_qualifie', label: 'Pas qualifié', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', visible: true },
  { key: 'dead', label: 'Dead ❌', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', visible: true },
]
const DEFAULT_SOURCE: LabelEntry[] = [
  { key: 'manuel', label: 'Manuel', color: '#a0a0a0', bg: 'rgba(160,160,160,0.10)', visible: true },
  { key: 'facebook_ads', label: 'Facebook Ads', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', visible: true },
  { key: 'instagram_ads', label: 'Instagram Ads', color: '#e879f9', bg: 'rgba(232,121,249,0.10)', visible: true },
  { key: 'follow_ads', label: 'Follow Ads', color: '#a855f7', bg: 'rgba(168,85,247,0.10)', visible: true },
  { key: 'formulaire', label: 'Formulaire', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)', visible: true },
  { key: 'funnel', label: 'Funnel', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', visible: true },
]

function Section({ title, description, children, danger }: { title: string; description: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className="soc-card" style={danger ? { borderColor: 'var(--color-danger-soft)' } : undefined}>
      <div>
        <h2 className="soc-card-title" style={danger ? { color: 'var(--color-danger)' } : undefined}>
          {title}
        </h2>
        <p className="soc-card-sub">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function SettingsAccountPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, notify, clearNotice] = useNotice()

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get<{ data: { user: UserData; workspace: WorkspaceData } }>('/api/user/profile')
      setUser(r.data.user)
      setWorkspace(r.data.workspace)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error || !user || !workspace) return <ErrorState message={error ?? 'Erreur de chargement'} onRetry={() => void load()} />

  return (
    <div className="soc-page">
      <header className="soc-header">
        <div>
          <h1>Réglages</h1>
          <p>Gérez votre compte, votre workspace et la personnalisation de ClosRM.</p>
        </div>
      </header>
      <NoticeBanner notice={notice} onClose={clearNotice} />
      <Section title="Plan & consommation" description="Votre plan actuel, quotas inclus et consommation de la période.">
        <PlanOverview />
      </Section>
      <Section title="Profil" description="Vos informations personnelles visibles par vous et votre équipe.">
        <ProfileForm user={user} notify={notify} onSaved={() => void load()} />
      </Section>
      <Section title="Workspace" description="Nom, fuseau horaire et paramètres globaux de votre espace de travail.">
        <WorkspaceForm workspace={workspace} notify={notify} onSaved={() => void load()} />
      </Section>
      <Section title="Personnalisation" description="Couleur d'accent et logo utilisés dans l'interface et sur vos pages publiques.">
        <BrandingForm workspace={workspace} notify={notify} onSaved={() => void load()} />
      </Section>
      <LabelsSections notify={notify} />
      <Section title="Lien de prise de RDV" description="Ce slug personnalise l'URL publique de vos calendriers de réservation.">
        <SlugForm notify={notify} />
      </Section>
      <Section title="Zone dangereuse" description="Actions irréversibles concernant votre compte et votre workspace." danger>
        <DeleteAccount workspaceName={workspace.name} />
      </Section>
    </div>
  )
}

function PlanOverview() {
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<PlanData>('/api/billing/plan')
      .then(setData)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <p className="soc-error">{error}</p>
  if (!data?.plan) return <p className="soc-muted">Aucune donnée de plan disponible.</p>
  const { workspace: ws, plan, quotas } = data
  const trialDays =
    ws.trial_ends_at && ws.subscription_status === 'trial' ? Math.max(0, Math.ceil((Date.parse(ws.trial_ends_at) - Date.now()) / 86400000)) : null

  return (
    <div className="soc-stack">
      <div className="soc-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong style={{ fontSize: 16 }}>{plan.name}</strong>
          <div className="soc-muted">
            {ws.is_internal
              ? 'Bypass billing (compte interne)'
              : `${(plan.base_price_cents / 100).toFixed(0)} €/mois${plan.additional_seat_price_cents ? ` + ${(plan.additional_seat_price_cents / 100).toFixed(0)} €/siège` : ''}`}
          </div>
        </div>
        {!ws.is_internal && <span className="soc-muted">Portail d'abonnement Stripe : pas encore disponible (web : « phase P2 »).</span>}
      </div>
      {trialDays !== null && (
        <div className="soc-banner soc-banner--warning">
          Essai en cours — {trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''}.
        </div>
      )}
      <StatGrid>
        <StatCard label="Sièges actifs" value={`${ws.seats_count ?? 1}${plan.max_seats ? ` / ${plan.max_seats}` : ''}`} />
        <StatCard
          label="Wallet"
          value={`${((ws.wallet_balance_cents ?? 0) / 100).toFixed(2)} €`}
          caption={ws.wallet_auto_recharge_enabled ? `Auto-recharge : ${((ws.wallet_auto_recharge_amount_cents ?? 0) / 100).toFixed(0)} €` : 'Auto-recharge désactivée'}
        />
        <StatCard
          label="Période"
          value={ws.current_period_end ? new Date(ws.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}
          caption="Fin de période"
        />
      </StatGrid>
      <div className="soc-stack">
        {quotas.map((q) => {
          const unlimited = q.quota_total >= Number.MAX_SAFE_INTEGER / 2
          const pct = q.quota_total > 0 ? Math.min(100, (q.quota_used / q.quota_total) * 100) : 0
          const color = pct < 70 ? 'var(--color-success)' : pct < 90 ? 'var(--color-warning)' : 'var(--color-danger)'
          return (
            <div key={q.resource_type} className="soc-field">
              <div className="soc-label">
                <span>{RESOURCE_LABEL[q.resource_type] ?? q.resource_type}</span>
                <span className="ds-num">
                  {formatNumber(q.quota_used)} / {unlimited ? '∞' : formatNumber(q.quota_total)}
                </span>
              </div>
              <div className="soc-bar">
                <span style={{ width: unlimited ? '3%' : `${pct}%`, background: color }} />
              </div>
              {!unlimited && q.fair_use_cap && <span className="soc-muted">Fair-use : {formatNumber(q.fair_use_cap)} / mois max.</span>}
            </div>
          )
        })}
        {!ws.is_internal && (
          <span className="soc-muted">Au-delà du quota inclus, l'usage est facturé sur votre wallet : {(plan.overage_email_price_cents_per_1k / 100).toFixed(2)} € / 1 000 emails.</span>
        )}
      </div>
    </div>
  )
}

function ProfileForm({ user, notify, onSaved }: { user: UserData; notify: (t: string, tone?: 'success' | 'danger') => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [avatar, setAvatar] = useState(user.avatar_url)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await http<{ data: { url: string } }>('POST', '/api/user/avatar', fd)
      setAvatar(r.data.url)
      notify('Photo mise à jour')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setUploading(false)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (fullName.trim().length < 2) {
      notify('Le nom doit faire au moins 2 caractères.', 'danger')
      return
    }
    setSaving(true)
    try {
      await api.patch('/api/user/profile', { full_name: fullName.trim() })
      notify('Profil enregistré')
      onSaved()
    } catch (err) {
      notify(errMsg(err), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="soc-stack" onSubmit={save}>
      <div className="soc-row">
        <Avatar name={fullName || user.email} size={56} src={avatar} />
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <button type="button" className="ds-pill-button" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Upload…' : 'Changer la photo'}
        </button>
      </div>
      <Field label="Nom complet">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input value={user.email} disabled />
      </Field>
      <button type="submit" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function WorkspaceForm({ workspace, notify, onSaved }: { workspace: WorkspaceData; notify: (t: string, tone?: 'success' | 'danger') => void; onSaved: () => void }) {
  const [name, setName] = useState(workspace.name)
  const [timezone, setTimezone] = useState(workspace.timezone || 'Europe/Paris')
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/api/workspaces', { name: name.trim(), timezone })
      notify('Workspace enregistré')
      onSaved()
    } catch (err) {
      notify(errMsg(err), 'danger')
    } finally {
      setSaving(false)
    }
  }

  const known = TIMEZONES.some(([v]) => v === timezone)
  return (
    <form className="soc-stack" onSubmit={save}>
      <Field label="Nom du workspace">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Fuseau horaire">
        <select className="soc-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {!known && <option value={timezone}>{timezone}</option>}
          {TIMEZONES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} disabled={saving || name.trim().length < 2}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function BrandingForm({ workspace, notify, onSaved }: { workspace: WorkspaceData; notify: (t: string, tone?: 'success' | 'danger') => void; onSaved: () => void }) {
  const [color, setColor] = useState(workspace.accent_color ?? '#00C853')
  const [logo, setLogo] = useState(workspace.logo_url)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const valid = /^#[0-9A-Fa-f]{6}$/.test(color)

  async function saveColor() {
    setBusy(true)
    try {
      await api.patch('/api/workspaces', { accent_color: color })
      notify("Couleur d'accent enregistrée")
      onSaved()
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function uploadLogo(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await http<{ data: { logo_url: string } }>('POST', '/api/workspaces/logo', fd)
      setLogo(r.data.logo_url)
      notify('Logo mis à jour')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function removeLogo() {
    setBusy(true)
    try {
      await api.delete('/api/workspaces/logo')
      setLogo(null)
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="soc-stack">
      <Field label="Couleur d'accent">
        <div className="soc-row">
          <input type="color" value={valid ? color : '#00c853'} onChange={(e) => setColor(e.target.value)} />
          <div style={{ width: 140 }}>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#000000" />
          </div>
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={busy || !valid || color === workspace.accent_color} onClick={() => void saveColor()}>
            Enregistrer
          </button>
        </div>
      </Field>
      <Field label="Logo">
        <div className="soc-row">
          {logo ? <img src={logo} alt="Logo" style={{ height: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--color-border)' }} /> : <span className="soc-muted">Aucun logo</span>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
          <button type="button" className="ds-pill-button" disabled={busy} onClick={() => fileRef.current?.click()}>
            {logo ? 'Remplacer' : 'Uploader'}
          </button>
          {logo && (
            <button type="button" className="ds-pill-button" disabled={busy} onClick={() => void removeLogo()}>
              Supprimer
            </button>
          )}
        </div>
      </Field>
    </div>
  )
}

function LabelsSections({ notify }: { notify: (t: string, tone?: 'success' | 'danger') => void }) {
  const [status, setStatus] = useState<LabelEntry[] | null>(null)
  const [source, setSource] = useState<LabelEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ data: { status_config: LabelEntry[]; source_config: LabelEntry[] } }>('/api/workspace/config')
      .then((r) => {
        setStatus(r.data.status_config)
        setSource(r.data.source_config)
      })
      .catch((e) => setError(errMsg(e)))
  }, [])

  async function patch(kind: 'status_config' | 'source_config', next: LabelEntry[] | null, previous: LabelEntry[]) {
    const setter = kind === 'status_config' ? setStatus : setSource
    setter(next ?? (kind === 'status_config' ? DEFAULT_STATUS : DEFAULT_SOURCE))
    try {
      const r = await api.patch<{ data?: { status_config?: LabelEntry[]; source_config?: LabelEntry[] } }>('/api/workspace/config', { [kind]: next })
      const fresh = r.data?.[kind]
      if (fresh) setter(fresh)
    } catch (e) {
      setter(previous)
      notify(errMsg(e), 'danger')
    }
  }

  if (error) return <p className="soc-error">{error}</p>
  if (!status || !source) return <LoadingState />
  return (
    <>
      <Section title="Statuts du pipeline" description="Renommer, recolorer, réordonner ou masquer les statuts de leads.">
        <LabelsEditor entries={status} defaults={DEFAULT_STATUS} onChange={(n) => void patch('status_config', n, status)} onReset={() => void patch('status_config', null, status)} />
      </Section>
      <Section title="Sources des leads" description="Renommer, recolorer, réordonner ou masquer les sources d'acquisition.">
        <LabelsEditor entries={source} defaults={DEFAULT_SOURCE} onChange={(n) => void patch('source_config', n, source)} onReset={() => void patch('source_config', null, source)} />
      </Section>
    </>
  )
}

function LabelsEditor({ entries, defaults, onChange, onReset }: { entries: LabelEntry[]; defaults: LabelEntry[]; onChange: (next: LabelEntry[]) => void; onReset: () => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const update = (key: string, partial: Partial<LabelEntry>) => onChange(entries.map((e) => (e.key === key ? { ...e, ...partial } : e)))
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= entries.length) return
    const next = [...entries]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  return (
    <div className="soc-stack" style={{ gap: 6 }}>
      {entries.map((e, idx) => {
        const def = defaults.find((d) => d.key === e.key)
        const isVar = e.color.startsWith('var(')
        const label = drafts[e.key] ?? e.label
        return (
          <div key={e.key} className="soc-row" style={{ flexWrap: 'nowrap', padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 10 }}>
            <button type="button" className="ds-pill-button" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Monter">
              ↑
            </button>
            <button type="button" className="ds-pill-button" disabled={idx === entries.length - 1} onClick={() => move(idx, 1)} aria-label="Descendre">
              ↓
            </button>
            <input type="checkbox" checked={e.visible} onChange={(ev) => update(e.key, { visible: ev.target.checked })} aria-label={`Visible : ${e.label}`} />
            <input type="color" value={isVar ? '#00c853' : e.color || '#999999'} onChange={(ev) => update(e.key, { color: ev.target.value, bg: hexToRgba(ev.target.value, 0.12) })} />
            <div style={{ flex: 1 }}>
              <Input
                value={label}
                onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                onBlur={() => {
                  const v = (drafts[e.key] ?? e.label).trim() || def?.label || e.key
                  setDrafts((d) => {
                    const n = { ...d }
                    delete n[e.key]
                    return n
                  })
                  if (v !== e.label) update(e.key, { label: v })
                }}
              />
            </div>
            <span className="ds-status-pill" style={{ color: e.color, background: e.bg }}>
              {e.label}
            </span>
            {def && (
              <button type="button" className="ds-pill-button" onClick={() => update(e.key, { label: def.label, color: def.color, bg: def.bg, visible: def.visible })}>
                Réinit.
              </button>
            )}
          </div>
        )
      })}
      <button type="button" className="ds-pill-button" style={{ alignSelf: 'flex-start' }} onClick={onReset}>
        Tout réinitialiser
      </button>
    </div>
  )
}

function SlugForm({ notify }: { notify: (t: string, tone?: 'success' | 'danger') => void }) {
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api
      .get<{ slug?: string | null }>('/api/workspaces/slug')
      .then((r) => setSlug(r.slug ?? ''))
      .catch(() => {})
  }, [])
  async function save() {
    setSaving(true)
    try {
      await http('PUT', '/api/workspaces/slug', { slug })
      notify('Slug sauvegardé')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="soc-row">
      <span className="soc-muted">{webUrl('/book/')}</span>
      <div style={{ width: 220 }}>
        <Input value={slug} placeholder="mon-slug" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
      </div>
      <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving || !slug} onClick={() => void save()}>
        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
      </button>
    </div>
  )
}

function DeleteAccount({ workspaceName }: { workspaceName: string }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await http('DELETE', '/api/user/account', { confirmation })
      await supabase.auth.signOut()
    } catch (e) {
      setError(errMsg(e))
      setDeleting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="ds-pill-button soc-danger-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        Supprimer mon compte et le workspace
      </button>
    )
  }
  return (
    <div className="soc-stack">
      <p style={{ margin: 0, fontSize: 13 }}>
        Toutes les données du workspace seront supprimées définitivement. Tapez <strong>{workspaceName}</strong> pour confirmer.
      </p>
      <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={workspaceName} />
      {error && <p className="soc-error">{error}</p>}
      <div className="soc-row">
        <button type="button" className="ds-pill-button" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button type="button" className="ds-pill-button ds-pill-button--dark soc-danger-btn" disabled={deleting || confirmation !== workspaceName} onClick={() => void remove()}>
          {deleting ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </div>
    </div>
  )
}
