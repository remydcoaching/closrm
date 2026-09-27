// Équipe › Membres — port of parametres/equipe/equipe-client.tsx + InviteMemberModal.
// Sub-views: Membres, Reporting (admin), Objectifs & commissions (admin),
// Formation (heavy training content → web). Endpoints: GET/POST
// /api/workspaces/members, PATCH/DELETE /api/workspaces/members/:userId,
// GET /api/workspaces/reporting, GET/POST /api/workspaces/objectives,
// GET/POST /api/workspaces/commissions, GET /api/auth/me.
// The current user's role comes from /api/auth/me (the web infers it from
// "the admin member", which is wrong for non-admin viewers).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { Avatar } from '../../design-system/Avatar'
import { ContactCell, TableCard } from '../../design-system/TableCard'
import { Chips, Tabs } from '../../design-system/Tabs'
import { Input } from '../../design-system/Input'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { EmptyState, ErrorState, LoadingState } from '../../design-system/States'
import { ConfirmButton, Field, Modal, NoticeBanner, useNotice } from '../social/ui'
import { errMsg } from '../social/http'
import { isoDay } from '../social/social-utils'
import '../social/social.css'
import '../../design-system/status-pill.css'
import { swrGet } from '../../lib/query-cache'

type Role = 'admin' | 'setter' | 'closer' | 'monteur'
type MemberStatus = 'active' | 'invited' | 'suspended'
type Notify = (text: string, tone?: 'success' | 'danger' | 'info' | 'warning') => void

interface Member {
  id: string
  user_id: string
  role: Role
  status: MemberStatus
  invited_at: string
  activated_at: string | null
  created_at: string
  user: { id: string; email: string; full_name: string | null; avatar_url: string | null }
}
interface MemberStats {
  messages_sent: number
  calls_total: number
  calls_reached: number
  rdv_booked: number
  closings: number
  deal_amount: number
  no_shows: number
  joignabilite: number
  closing_rate: number
}
interface MemberReport {
  user_id: string
  full_name: string
  email: string
  role: string
  stats: MemberStats
}
interface Objective {
  id: string
  user_id: string | null
  role: string | null
  metric: string
  target_value: number
}
interface Commission {
  id: string
  user_id: string | null
  role: string | null
  type: 'percentage' | 'fixed'
  value: number
  bonus_threshold: number | null
  bonus_amount: number | null
}

const ROLE_META: Record<Role, { label: string; color: string }> = {
  admin: { label: 'Admin', color: '#d63447' },
  setter: { label: 'Setter', color: '#3b82f6' },
  closer: { label: 'Closer', color: '#1a7f4e' },
  monteur: { label: 'Monteur', color: '#8b5cf6' },
}
const STATUS_META: Record<MemberStatus, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#1a7f4e' },
  invited: { label: 'Invité', color: '#d9820b' },
  suspended: { label: 'Suspendu', color: '#6b6f76' },
}
const SETTER_OBJECTIVES = [
  { metric: 'calls_per_day', label: 'Appels / jour', suffix: '', def: 15 },
  { metric: 'rdv_per_week', label: 'RDV / semaine', suffix: '', def: 5 },
  { metric: 'joignabilite', label: 'Joignabilité', suffix: '%', def: 40 },
]
const CLOSER_OBJECTIVES = [
  { metric: 'closings_per_month', label: 'Closings / mois', suffix: '', def: 10 },
  { metric: 'ca_per_month', label: 'CA / mois', suffix: '€', def: 20000 },
  { metric: 'taux_closing', label: 'Taux closing', suffix: '%', def: 30 },
]

function euro(v: number): string {
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}
function pctColor(p: number): string {
  return p >= 50 ? 'var(--color-success)' : p >= 30 ? 'var(--color-warning)' : 'var(--color-danger)'
}
function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint32Array(10)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => chars[n % chars.length]).join('')
}

export function TeamPage() {
  const [tab, setTab] = useState<'members' | 'reporting' | 'objectives' | 'training'>('members')
  const [me, setMe] = useState<{ userId: string; role: Role } | null>(null)
  const [notice, notify, clearNotice] = useNotice()

  useEffect(() => {
    api
      .get<{ data: { userId: string; role: Role } }>('/api/auth/me')
      .then((r) => setMe(r.data))
      .catch(() => {})
  }, [])

  const isAdmin = me?.role === 'admin'

  return (
    <div className="soc-page">
      <header className="soc-header">
        <div>
          <h1>Équipe</h1>
          <p>Gérez les membres de votre équipe, leurs rôles, objectifs et commissions.</p>
        </div>
        <Tabs
          items={[
            { key: 'members', label: 'Membres' },
            ...(isAdmin ? [{ key: 'reporting' as const, label: 'Reporting' }, { key: 'objectives' as const, label: 'Objectifs & commissions' }] : []),
            { key: 'training', label: 'Formation' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </header>
      <NoticeBanner notice={notice} onClose={clearNotice} />
      {tab === 'members' && <MembersTab me={me} notify={notify} />}
      {tab === 'reporting' && isAdmin && <ReportingTab />}
      {tab === 'objectives' && isAdmin && <ObjectivesTab notify={notify} />}
      {tab === 'training' && (
        <section className="soc-card" style={{ alignItems: 'flex-start' }}>
          <h2 className="soc-card-title">Formation de l'équipe</h2>
          <p className="soc-muted" style={{ margin: 0 }}>Les modules de formation (contenus, vidéos, progression) s'ouvrent dans l'app web.</p>
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => void openWeb('/equipe/formation')}>
            Ouvrir la formation ↗
          </button>
        </section>
      )}
    </div>
  )
}

function MembersTab({ me, notify }: { me: { userId: string; role: Role } | null; notify: Notify }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    setError(null)
    try {
      await swrGet<{ data: Member[] }>('/api/workspaces/members', (r) => {
        setMembers(r.data ?? [])
        setLoading(false)
      })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(m: Member, body: { role?: Role; status?: MemberStatus }, ok: string) {
    try {
      await api.patch(`/api/workspaces/members/${m.user_id}`, body)
      notify(ok)
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function remove(m: Member) {
    try {
      await api.delete(`/api/workspaces/members/${m.user_id}`)
      notify('Membre retiré')
      void load()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const counts = (r: Role) => members.filter((m) => m.role === r && m.status !== 'suspended').length

  return (
    <>
      <StatGrid>
        <StatCard label="Membres" value={members.length} highlight />
        <StatCard label="Setters" value={counts('setter')} />
        <StatCard label="Closers" value={counts('closer')} />
        <StatCard label="Monteurs" value={counts('monteur')} />
      </StatGrid>
      <TableCard
        title="Membres"
        subtitle={`${members.length} membre${members.length > 1 ? 's' : ''}`}
        toolbar={
          isAdmin && (
            <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => setInviting(true)}>
              + Inviter un membre
            </button>
          )
        }
      >
        {members.length === 0 ? (
          <EmptyState title="Aucun membre" />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th className="ds-num-cell">Ajouté le</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = m.user.full_name || m.user.email
                const self = m.user_id === me?.userId
                return (
                  <tr key={m.id} className={m.status === 'suspended' ? 'ds-muted' : undefined}>
                    <td>
                      <ContactCell name={`${name}${self ? ' (vous)' : ''}`} avatar={<Avatar name={name} src={m.user.avatar_url} size={32} />} />
                      <div className="ds-muted" style={{ fontSize: 11, marginLeft: 44 }}>{m.user.email}</div>
                    </td>
                    <td>
                      {isAdmin && !self && m.role !== 'admin' ? (
                        <select className="soc-select" value={m.role} onChange={(e) => void patch(m, { role: e.target.value as Role }, 'Rôle mis à jour')}>
                          {(['setter', 'closer', 'monteur'] as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_META[r].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="ds-status-pill" style={{ color: ROLE_META[m.role].color, background: `${ROLE_META[m.role].color}1a` }}>
                          {ROLE_META[m.role].label}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="ds-status-pill" style={{ color: STATUS_META[m.status].color, background: `${STATUS_META[m.status].color}1a` }}>
                        {STATUS_META[m.status].label}
                      </span>
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{new Date(m.activated_at ?? m.invited_at ?? m.created_at).toLocaleDateString('fr-FR')}</span>
                    </td>
                    {isAdmin && (
                      <td>
                        {!self && m.role !== 'admin' && (
                          <div className="soc-row" style={{ flexWrap: 'nowrap' }}>
                            {m.role === 'monteur' && (
                              <button type="button" className="ds-pill-button" onClick={() => void openWeb(`/parametres/equipe/${m.user_id}/prestations`)}>
                                Prestations ↗
                              </button>
                            )}
                            {m.status === 'suspended' ? (
                              <button type="button" className="ds-pill-button" onClick={() => void patch(m, { status: 'active' }, 'Membre réactivé')}>
                                Réactiver
                              </button>
                            ) : (
                              <ConfirmButton label="Suspendre" onConfirm={() => void patch(m, { status: 'suspended' }, 'Membre suspendu')} />
                            )}
                            <ConfirmButton label="Retirer" confirmLabel="Retirer définitivement ?" onConfirm={() => void remove(m)} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </TableCard>
      {inviting && <InviteModal onClose={() => setInviting(false)} onCreated={() => void load()} />}
    </>
  )
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [role, setRole] = useState<Role>('setter')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/workspaces/members', { email: email.trim(), full_name: fullName.trim(), password, role })
      setCreated({ email: email.trim(), password })
      onCreated()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    const text = `Email : ${created.email}\nMot de passe : ${created.password}`
    return (
      <Modal title="Membre créé" onClose={onClose}>
        <div className="soc-stack">
          <p style={{ margin: 0 }}>Transmettez ces identifiants au membre :</p>
          <pre style={{ fontFamily: 'var(--font-mono)', background: 'var(--color-bg-muted)', padding: 12, borderRadius: 10, margin: 0 }}>{text}</pre>
          <div className="lead-create-actions">
            <button type="button" className="ds-pill-button" onClick={() => void navigator.clipboard.writeText(text)}>
              Copier
            </button>
            <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={onClose}>
              Terminé
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Inviter un membre" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Nom complet">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field
          label="Mot de passe"
          action={
            <button type="button" className="soc-link-btn" onClick={() => setPassword(generatePassword())}>
              Régénérer
            </button>
          }
        >
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Rôle">
          <Chips
            items={[
              { key: 'setter', label: 'Setter' },
              { key: 'closer', label: 'Closer' },
              { key: 'monteur', label: 'Monteur' },
            ]}
            active={role}
            onChange={setRole}
          />
        </Field>
        {error && <p className="lead-create-error">{error}</p>}
        <div className="lead-create-actions">
          <button type="button" className="ds-pill-button" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="ds-pill-button ds-pill-button--dark" disabled={saving || !email.includes('@') || password.length < 6}>
            {saving ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ReportingTab() {
  const [days, setDays] = useState<'7' | '14' | '30'>('7')
  const [data, setData] = useState<MemberReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    setLoading(true)
    setError(null)
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - Number(days))
    api
      .get<{ data: { members: MemberReport[] } }>(`/api/workspaces/reporting?date_from=${isoDay(from)}&date_to=${isoDay(to)}`)
      .then((r) => !c && setData(r.data?.members ?? []))
      .catch((e) => !c && setError(errMsg(e)))
      .finally(() => !c && setLoading(false))
    return () => {
      c = true
    }
  }, [days])

  const totals = useMemo(() => {
    const t = data.reduce(
      (acc, m) => ({
        calls_total: acc.calls_total + m.stats.calls_total,
        calls_reached: acc.calls_reached + m.stats.calls_reached,
        rdv_booked: acc.rdv_booked + m.stats.rdv_booked,
        closings: acc.closings + m.stats.closings,
        deal_amount: acc.deal_amount + m.stats.deal_amount,
        no_shows: acc.no_shows + m.stats.no_shows,
      }),
      { calls_total: 0, calls_reached: 0, rdv_booked: 0, closings: 0, deal_amount: 0, no_shows: 0 },
    )
    return {
      ...t,
      joignabilite: t.calls_total > 0 ? Math.round((t.calls_reached / t.calls_total) * 100) : 0,
      closing_rate: t.rdv_booked > 0 ? Math.round((t.closings / t.rdv_booked) * 100) : 0,
    }
  }, [data])

  const alerts = data.flatMap((m) => {
    const out: { tone: 'warning' | 'success'; text: string }[] = []
    if (m.stats.calls_total === 0) out.push({ tone: 'warning', text: `${m.full_name} n'a fait aucun appel sur cette période` })
    if (m.stats.joignabilite > 0 && m.stats.joignabilite < 30) out.push({ tone: 'warning', text: `${m.full_name} a un taux de joignabilité de ${m.stats.joignabilite} % (< 30 %)` })
    if (m.role === 'closer' && m.stats.closings >= 5) out.push({ tone: 'success', text: `${m.full_name} a atteint son objectif de closings` })
    return out
  })

  return (
    <div className="soc-stack">
      <Chips
        items={[
          { key: '7', label: '7 jours' },
          { key: '14', label: '14 jours' },
          { key: '30', label: '30 jours' },
        ]}
        active={days}
        onChange={setDays}
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Appels" value={totals.calls_total} />
            <StatCard label="Joignabilité" value={`${totals.joignabilite} %`} />
            <StatCard label="RDV bookés" value={totals.rdv_booked} />
            <StatCard label="Closings" value={totals.closings} caption={`Taux closing ${totals.closing_rate} %`} />
            <StatCard label="CA" value={euro(totals.deal_amount)} highlight />
          </StatGrid>
          {alerts.map((a, i) => (
            <div key={i} className={`soc-banner soc-banner--${a.tone}`}>
              {a.text}
            </div>
          ))}
          <TableCard title="Performance par membre">
            {data.length === 0 ? (
              <EmptyState title="Aucune donnée sur la période" />
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Rôle</th>
                    <th className="ds-num-cell">Appels</th>
                    <th className="ds-num-cell">Répondus</th>
                    <th className="ds-num-cell">% Joign.</th>
                    <th className="ds-num-cell">RDV</th>
                    <th className="ds-num-cell">Closings</th>
                    <th className="ds-num-cell">CA</th>
                    <th className="ds-num-cell">No-shows</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => {
                    const rm = ROLE_META[m.role as Role]
                    return (
                      <tr key={m.user_id} className={m.stats.calls_total === 0 ? 'ds-row--alert' : undefined}>
                        <td>
                          <ContactCell name={m.full_name || m.email} avatar={<Avatar name={m.full_name || m.email} size={28} />} />
                        </td>
                        <td>{rm ? <span className="ds-status-pill" style={{ color: rm.color, background: `${rm.color}1a` }}>{rm.label}</span> : m.role}</td>
                        <td className="ds-num-cell"><span className="ds-num">{m.stats.calls_total}</span></td>
                        <td className="ds-num-cell"><span className="ds-num">{m.stats.calls_reached}</span></td>
                        <td className="ds-num-cell"><span className="ds-num" style={{ color: pctColor(m.stats.joignabilite) }}>{m.stats.joignabilite} %</span></td>
                        <td className="ds-num-cell"><span className="ds-num">{m.stats.rdv_booked}</span></td>
                        <td className="ds-num-cell"><span className="ds-num">{m.stats.closings}</span></td>
                        <td className="ds-num-cell"><span className="ds-num">{euro(m.stats.deal_amount)}</span></td>
                        <td className="ds-num-cell"><span className="ds-num" style={m.stats.no_shows > 0 ? { color: 'var(--color-danger)' } : undefined}>{m.stats.no_shows}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </TableCard>
        </>
      )}
    </div>
  )
}

function ObjectivesTab({ notify }: { notify: Notify }) {
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [comm, setComm] = useState<{ type: 'percentage' | 'fixed'; value: number; bonus_threshold: number; bonus_amount: number }>({
    type: 'percentage',
    value: 10,
    bonus_threshold: 10,
    bonus_amount: 200,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<{ data: Objective[] }>('/api/workspaces/objectives').catch(() => ({ data: [] as Objective[] })),
      api.get<{ data: Commission[] }>('/api/workspaces/commissions').catch(() => ({ data: [] as Commission[] })),
    ])
      .then(([o, c]) => {
        const d: Record<string, number> = {}
        for (const obj of o.data ?? []) d[`${obj.role || 'none'}_${obj.metric}`] = obj.target_value
        setDraft(d)
        const def = (c.data ?? []).find((x) => !x.user_id)
        if (def) setComm({ type: def.type, value: def.value, bonus_threshold: def.bonus_threshold ?? 10, bonus_amount: def.bonus_amount ?? 200 })
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveObjective(role: string, metric: string, value: number) {
    setSaving(`${role}_${metric}`)
    try {
      await api.post('/api/workspaces/objectives', { role, metric, target_value: value })
      notify('Objectif enregistré')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setSaving(null)
    }
  }

  async function saveCommission() {
    setSaving('commission')
    try {
      await api.post('/api/workspaces/commissions', {
        role: 'closer',
        type: comm.type,
        value: comm.value,
        bonus_threshold: comm.bonus_threshold || null,
        bonus_amount: comm.bonus_amount || null,
      })
      notify('Commission enregistrée')
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingState />

  const block = (role: 'setter' | 'closer', title: string, list: typeof SETTER_OBJECTIVES) => (
    <section className="soc-card">
      <h2 className="soc-card-title">{title}</h2>
      {list.map((o) => {
        const key = `${role}_${o.metric}`
        const value = draft[key] ?? o.def
        return (
          <div key={o.metric} className="soc-row" style={{ flexWrap: 'nowrap' }}>
            <span style={{ flex: 1 }}>{o.label}</span>
            <div style={{ width: 120 }}>
              <Input type="number" min={0} value={value} onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))} />
            </div>
            <span className="soc-muted" style={{ width: 16 }}>{o.suffix}</span>
            <button type="button" className="ds-pill-button" disabled={saving === key} onClick={() => void saveObjective(role, o.metric, value)}>
              {saving === key ? '…' : 'Enregistrer'}
            </button>
          </div>
        )
      })}
    </section>
  )

  return (
    <div className="soc-stack">
      <div className="soc-grid-2">
        {block('setter', 'Objectifs setters', SETTER_OBJECTIVES)}
        {block('closer', 'Objectifs closers', CLOSER_OBJECTIVES)}
      </div>
      <section className="soc-card">
        <h2 className="soc-card-title">Commission closers (par défaut)</h2>
        <Chips
          items={[
            { key: 'percentage', label: 'Pourcentage' },
            { key: 'fixed', label: 'Montant fixe' },
          ]}
          active={comm.type}
          onChange={(t) => setComm((c) => ({ ...c, type: t }))}
        />
        <div className="soc-row">
          <Field label={comm.type === 'percentage' ? 'Commission (%)' : 'Commission (€ / deal)'}>
            <Input type="number" min={0} value={comm.value} onChange={(e) => setComm((c) => ({ ...c, value: Number(e.target.value) }))} />
          </Field>
          <Field label="Bonus à partir de (closings / mois)">
            <Input type="number" min={0} value={comm.bonus_threshold} onChange={(e) => setComm((c) => ({ ...c, bonus_threshold: Number(e.target.value) }))} />
          </Field>
          <Field label="Montant du bonus (€)">
            <Input type="number" min={0} value={comm.bonus_amount} onChange={(e) => setComm((c) => ({ ...c, bonus_amount: Number(e.target.value) }))} />
          </Field>
        </div>
        <button type="button" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} disabled={saving === 'commission'} onClick={() => void saveCommission()}>
          {saving === 'commission' ? 'Enregistrement…' : 'Enregistrer la commission'}
        </button>
      </section>
    </div>
  )
}
