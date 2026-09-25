// Closing — same tabs, same GET /api/calls filters and same "traiter"
// actions as the web's src/app/(dashboard)/closing/closing-client.tsx.
// Every action is a sequence of existing endpoints (PATCH /api/calls/:id,
// POST /api/deals, POST /api/follow-ups, PATCH /api/leads/:id) — no new
// backend logic.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { SearchInput } from '../../design-system/SearchInput'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { Tabs, Chips } from '../../design-system/Tabs'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { CallType, CallWithLead, CallsListResponse } from './types'
import './crm.css'
import '../leads/lead-create-modal.css'
import '../leads/leads-list.css'
import { TableCard } from '../../design-system/TableCard'

type Tab = 'today' | 'upcoming' | 'overdue' | 'done' | 'cancelled'

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'upcoming', label: 'À venir' },
  { key: 'overdue', label: 'À actualiser' },
  { key: 'done', label: 'Traités' },
  { key: 'cancelled', label: 'Annulés / Absents' },
]

const PER_PAGE = 25

const OUTCOME_LABELS: Record<string, string> = {
  pending: 'En attente',
  done: 'Fait',
  cancelled: 'Annulé',
  no_show: 'Absent',
}

function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Query string for a tab — identical filters to the web's buildParams(). */
export function closingTabParams(tab: Tab): URLSearchParams {
  const { start, end } = dayBounds()
  const p = new URLSearchParams()
  p.set('sort', 'scheduled_at')
  if (tab === 'today') {
    p.set('outcome', 'pending')
    p.set('scheduled_after', start)
    p.set('scheduled_before', end)
    p.set('order', 'asc')
  } else if (tab === 'upcoming') {
    p.set('outcome', 'pending')
    p.set('scheduled_after', end)
    p.set('order', 'asc')
  } else if (tab === 'overdue') {
    p.set('outcome', 'pending')
    p.set('scheduled_before', start)
    p.set('order', 'desc')
  } else if (tab === 'done') {
    p.set('outcome', 'done')
    p.set('order', 'desc')
  } else {
    p.set('outcome', 'cancelled,no_show')
    p.set('order', 'desc')
  }
  return p
}

export function ClosingPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('today')
  const [type, setType] = useState<CallType | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [calls, setCalls] = useState<CallWithLead[] | null>(null)
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 })
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({})
  const [error, setError] = useState<string | null>(null)
  const [treatTarget, setTreatTarget] = useState<CallWithLead | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [tab, type, search])

  const load = useCallback(async () => {
    setError(null)
    setCalls(null)
    try {
      const p = closingTabParams(tab)
      p.set('page', String(page))
      p.set('per_page', String(PER_PAGE))
      if (type) p.set('type', type)
      if (search) p.set('search', search)
      const res = await api.get<CallsListResponse>(`/api/calls?${p.toString()}`)
      setCalls(res.data)
      setMeta({ total: res.meta.total, total_pages: res.meta.total_pages })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }, [tab, page, type, search])

  const loadCounts = useCallback(async () => {
    const entries = await Promise.all(
      TABS.map(async ({ key }) => {
        const p = closingTabParams(key)
        p.set('per_page', '1')
        try {
          const res = await api.get<CallsListResponse>(`/api/calls?${p.toString()}`)
          return [key, res.meta.total] as const
        } catch {
          return [key, undefined] as const
        }
      }),
    )
    setCounts(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  function refresh() {
    load()
    loadCounts()
  }

  async function setOutcome(call: CallWithLead, outcome: 'no_show' | 'cancelled') {
    await api.patch(`/api/calls/${call.id}`, { outcome })
    refresh()
  }

  return (
    <div className="crm-page">
      <div className="crm-page-header">
        <div>
          <h1>Closing</h1>
          <p>Gestion de vos appels de setting et closing</p>
        </div>
        <div className="closing-filters">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Rechercher un lead…" />
          <Tabs
            items={[
              { key: 'all', label: 'Tous' },
              { key: 'setting', label: 'Setting' },
              { key: 'closing', label: 'Closing' },
            ]}
            active={type ?? 'all'}
            onChange={(k) => setType(k === 'all' ? null : (k as CallType))}
          />
        </div>
      </div>

      <Chips items={TABS.map((t) => ({ ...t, count: counts[t.key] }))} active={tab} onChange={setTab} />

      {calls === null && !error && <LoadingState label="Chargement des appels…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {calls && calls.length === 0 && <EmptyState title="Aucun appel" description="Rien dans cet onglet pour le moment." />}

      {calls && calls.length > 0 && (
        <>
          <TableCard>
            <table className="ds-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Prévu le</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const overdue = call.outcome === 'pending' && new Date(call.scheduled_at) < new Date()
                return (
                  <tr key={call.id} className={overdue ? 'ds-row--alert' : ''}>
                    <td className="crm-table-clickable" onClick={() => navigate(`/leads/${call.lead.id}`)}>
                      {`${call.lead.first_name} ${call.lead.last_name}`.trim() || '—'}
                    </td>
                    <td>
                      <div>{call.lead.phone || '—'}</div>
                      {call.lead.email && <div className="closing-muted">{call.lead.email}</div>}
                    </td>
                    <td>{call.type === 'closing' ? 'Closing' : 'Setting'}</td>
                    <td className={overdue ? 'crm-cell-overdue' : ''}>{new Date(call.scheduled_at).toLocaleString('fr-FR')}</td>
                    <td>{OUTCOME_LABELS[call.outcome] ?? call.outcome}</td>
                    <td>
                      {call.outcome === 'pending' && (
                        <div className="closing-actions">
                          <button className="crm-table-action" onClick={() => setTreatTarget(call)}>
                            Traiter
                          </button>
                          <button className="crm-table-action" onClick={() => setOutcome(call, 'no_show')}>
                            Absent
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </TableCard>

          {meta.total_pages > 1 && (
            <div className="leads-pagination">
              <span>
                Page {page} sur {meta.total_pages} — {meta.total} appels
              </span>
              <div className="leads-pagination-buttons">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </button>
                <button disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {treatTarget && (
        <TreatCallModal
          call={treatTarget}
          onClose={() => setTreatTarget(null)}
          onDone={() => {
            setTreatTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

type TreatAction = 'won' | 'follow_up' | 'pas_qualifie' | 'dead'

function TreatCallModal({ call, onClose, onDone }: { call: CallWithLead; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<TreatAction>('won')
  const [amount, setAmount] = useState('')
  const [cash, setCash] = useState('')
  const [installments, setInstallments] = useState('1')
  const [duration, setDuration] = useState('')
  const [reason, setReason] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [channel, setChannel] = useState('whatsapp')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (action === 'won') {
        if (!amount) throw new Error('Le montant est requis.')
        await api.patch(`/api/calls/${call.id}`, { outcome: 'done' })
        await api.post('/api/deals', {
          lead_id: call.lead.id,
          amount: Number(amount),
          cash_collected: cash ? Number(cash) : 0,
          installments: Number(installments) || 1,
          duration_months: duration ? Number(duration) : null,
        })
      } else if (action === 'follow_up') {
        if (!reason || !followUpDate) throw new Error('Raison et date requises.')
        await api.patch(`/api/calls/${call.id}`, { outcome: 'done' })
        await api.post('/api/follow-ups', {
          lead_id: call.lead.id,
          reason,
          scheduled_at: new Date(followUpDate).toISOString(),
          channel,
        })
      } else {
        await api.patch(`/api/calls/${call.id}`, { outcome: 'cancelled' })
        await api.patch(`/api/leads/${call.lead.id}`, { status: action })
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setSaving(false)
    }
  }

  const name = `${call.lead.first_name} ${call.lead.last_name}`.trim()

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Traiter l&apos;appel — {name}</h2>
        <form onSubmit={submit}>
          <div className="closing-choice">
            {(
              [
                ['won', 'Closé ✅'],
                ['follow_up', 'Relance'],
                ['pas_qualifie', 'Pas qualifié'],
                ['dead', 'Dead ❌'],
              ] as [TreatAction, string][]
            ).map(([key, label]) => (
              <button key={key} type="button" className={`closing-choice-btn ${action === key ? 'closing-choice-btn--active' : ''}`} onClick={() => setAction(key)}>
                {label}
              </button>
            ))}
          </div>

          {action === 'won' && (
            <>
              <Input type="number" min="0" placeholder="Montant total (€)" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              <Input type="number" min="0" placeholder="Cash collecté (€)" value={cash} onChange={(e) => setCash(e.target.value)} />
              <Input type="number" min="1" placeholder="Nombre de paiements" value={installments} onChange={(e) => setInstallments(e.target.value)} />
              <Input type="number" min="1" placeholder="Durée d'accompagnement (mois)" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </>
          )}

          {action === 'follow_up' && (
            <>
              <Input placeholder="Raison de la relance" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              <Input type="datetime-local" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
              <select className="closing-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram_dm">DM Instagram</option>
                <option value="email">Email</option>
                <option value="manuel">Manuel</option>
              </select>
            </>
          )}

          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Valider'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
