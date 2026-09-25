// Setter / closer dashboards — same endpoints and query strings as the web's
// src/components/dashboard/SetterDashboard.tsx and CloserDashboard.tsx.
// Two web bugs are NOT reproduced (both come from fields GET /api/leads
// doesn't select, so the web always shows 0):
//  • "Closés ce mois" → counted with date_field=closed_at on /api/leads
//  • "CA généré"      → Σ deals.amount of the closer's deals started this month (GET /api/deals?closer_id=)
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { callOutcomeLabel, callTypeLabel, followUpChannelLabel, sourceEntry, statusEntry } from '../leads/status'
import type { Lead, LeadsListResponse } from '../leads/types'
import type { CallWithLead, CallsListResponse, FollowUpsListResponse, FollowUpWithLead } from '../crm/types'
import { countLeads, fetchDeals } from '../stats/stats-api'
import { formatEuro, ratePct, startOfDay, sumBy } from '../stats/metrics'
import './dashboard.css'
import '../stats/stats.css'

const GOALS = { callsPerDay: 15, bookingsPerWeek: 5 } as const

interface HandoffBrief {
  objective?: string
  budget?: string
  objections?: string
  availability?: string
  notes?: string
}

type CallWithBrief = CallWithLead & { handoff_brief?: HandoffBrief | null }

function dayRange() {
  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function Header({ firstName, role }: { firstName: string; role: string }) {
  return (
    <div className="stats-page-header">
      <div>
        <h1>Bonjour, {firstName}</h1>
        <p>{role} — voici votre journée</p>
      </div>
    </div>
  )
}

function ProgressGoal({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const tone = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'
  return (
    <div className="dash-goal">
      <div className="dash-goal-head">
        <span>{label}</span>
        <span className="ds-num">
          {current}/{target}
        </span>
      </div>
      <div className="dash-goal-track">
        <div className={`dash-goal-fill dash-goal-fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Setter ─────────────────────────────────────────────────────────────────

interface SetterData {
  leads: Lead[]
  callsToday: CallWithLead[]
  followUps: FollowUpWithLead[]
  weekCalls: CallWithLead[]
}

export function SetterDashboard({ firstName, userId }: { firstName: string; userId: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<SetterData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { today, tomorrow } = dayRange()
    const monday = new Date(today)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const t = today.toISOString()
    const tm = tomorrow.toISOString()
    try {
      const [leads, callsToday, followUps, weekCalls] = await Promise.all([
        api.get<LeadsListResponse>(`/api/leads?assigned_to=${userId}&per_page=10&sort=created_at&order=desc`),
        api.get<CallsListResponse>(`/api/calls?scheduled_after=${t}&scheduled_before=${tm}&sort=scheduled_at&order=asc&per_page=100`),
        api.get<FollowUpsListResponse>(`/api/follow-ups?status=en_attente&scheduled_before=${tm}&sort=scheduled_at&order=asc`),
        api.get<CallsListResponse>(`/api/calls?scheduled_after=${monday.toISOString()}&scheduled_before=${tm}&per_page=100`),
      ])
      setData({ leads: leads.data, callsToday: callsToday.data, followUps: followUps.data, weekCalls: weekCalls.data })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (error)
    return (
      <div className="stats-page">
        <Header firstName={firstName} role="Setter" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  if (!data)
    return (
      <div className="stats-page">
        <Header firstName={firstName} role="Setter" />
        <LoadingState />
      </div>
    )

  const done = data.callsToday.filter((c) => c.outcome === 'done')
  const reached = done.filter((c) => c.reached).length
  const bookedToday = done.filter((c) => c.type === 'setting').length
  const weeklyBookings = data.weekCalls.filter((c) => c.outcome === 'done' && c.type === 'setting').length
  const openLead = (id: string) => navigate(`/leads/${id}`)

  return (
    <div className="stats-page">
      <Header firstName={firstName} role="Setter" />
      <StatGrid>
        <StatCard label="Appels passés" value={done.length} caption="Aujourd'hui" />
        <StatCard label="Appels répondus" value={reached} caption={done.length > 0 ? `${ratePct(reached, done.length)} % de joignabilité` : 'Aujourd\'hui'} />
        <StatCard label="RDV bookés" value={bookedToday} caption="Settings faits aujourd'hui" highlight />
        <StatCard label="Follow-ups restants" value={data.followUps.length} caption="En attente jusqu'à ce soir" onClick={() => navigate('/relances')} />
      </StatGrid>

      <div className="stats-grid-2">
        <TableCard title="Mes leads à traiter" subtitle="10 derniers leads assignés">
          {data.leads.length === 0 ? (
            <EmptyState title="Aucun lead assigné" />
          ) : (
            <table className="ds-table">
              <tbody>
                {data.leads.map((l) => {
                  const s = statusEntry(l.status)
                  const src = sourceEntry(l.source)
                  return (
                    <tr key={l.id} className="ds-row-clickable" onClick={() => openLead(l.id)}>
                      <td>
                        <div className="ds-contact-name">
                          {l.first_name} {l.last_name}
                        </div>
                        <div className="ds-muted">{l.phone || l.email || '—'}</div>
                      </td>
                      <td>
                        <StatusPill label={s.label} color={s.color} bg={s.bg} />
                      </td>
                      <td>
                        <StatusPill label={src.label} color={src.color} bg={src.bg} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </TableCard>

        <div className="dash-stack">
          <TableCard title="Mon agenda du jour">
            {data.callsToday.length === 0 && data.followUps.length === 0 ? (
              <EmptyState title="Rien de prévu aujourd'hui" />
            ) : (
              <table className="ds-table">
                <tbody>
                  {data.callsToday.map((c) => (
                    <tr key={c.id} className="ds-row-clickable" onClick={() => c.lead && openLead(c.lead.id)}>
                      <td className="ds-num-cell" style={{ textAlign: 'left', width: 70 }}>
                        <span className="ds-num">{timeOf(c.scheduled_at)}</span>
                      </td>
                      <td>
                        <div className="ds-contact-name">{c.lead ? `${c.lead.first_name} ${c.lead.last_name}` : 'Lead inconnu'}</div>
                        <div className="ds-muted">
                          {callTypeLabel(c.type)} · {callOutcomeLabel(c.outcome)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.followUps.map((f) => (
                    <tr key={f.id} className={`ds-row-clickable ${new Date(f.scheduled_at).getTime() < dayRange().today.getTime() ? 'ds-row--alert' : ''}`} onClick={() => f.lead && openLead(f.lead.id)}>
                      <td className="ds-num-cell" style={{ textAlign: 'left', width: 70 }}>
                        <span className="ds-muted">Relance</span>
                      </td>
                      <td>
                        <div className="ds-contact-name">{f.lead ? `${f.lead.first_name} ${f.lead.last_name}` : 'Lead inconnu'}</div>
                        <div className="ds-muted">Follow-up · {followUpChannelLabel(f.channel)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableCard>

          <section className="stats-card">
            <header className="stats-card-header">
              <div>
                <h2>Mes objectifs</h2>
              </div>
            </header>
            <ProgressGoal label="Appels / jour" current={done.length} target={GOALS.callsPerDay} />
            <ProgressGoal label="RDV bookés / semaine" current={weeklyBookings} target={GOALS.bookingsPerWeek} />
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Closer ─────────────────────────────────────────────────────────────────

interface CloserData {
  closingsToday: CallWithBrief[]
  pipeline: Lead[]
  closedThisMonth: number
  revenueThisMonth: number
  noShowsThisMonth: number
}

export function CloserDashboard({ firstName, userId }: { firstName: string; userId: string }) {
  const navigate = useNavigate()
  const [data, setData] = useState<CloserData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { today, tomorrow } = dayRange()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const t = today.toISOString()
    const tm = tomorrow.toISOString()
    try {
      const [closings, pipeline, closedThisMonth, deals, noShows] = await Promise.all([
        api.get<{ data: CallWithBrief[] }>(`/api/calls?type=closing&scheduled_after=${t}&scheduled_before=${tm}&sort=scheduled_at&order=asc&per_page=50`),
        api.get<LeadsListResponse>(`/api/leads?assigned_to=${userId}&status=closing_planifie,no_show_closing&per_page=50&sort=updated_at&order=desc`),
        countLeads({ assignedTo: userId, status: 'clos', dateField: 'closed_at', window: { from: monthStart, to: new Date() } }),
        fetchDeals({ closer_id: userId, date_from: monthStart.toISOString() }),
        api.get<CallsListResponse>(`/api/calls?type=closing&outcome=no_show&scheduled_after=${monthStart.toISOString()}&scheduled_before=${tm}&per_page=100`),
      ])
      setData({
        closingsToday: closings.data,
        pipeline: pipeline.data,
        closedThisMonth,
        revenueThisMonth: sumBy(deals, (d) => d.amount),
        noShowsThisMonth: noShows.data.length,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (error)
    return (
      <div className="stats-page">
        <Header firstName={firstName} role="Closer" />
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  if (!data)
    return (
      <div className="stats-page">
        <Header firstName={firstName} role="Closer" />
        <LoadingState />
      </div>
    )

  const attempts = data.closedThisMonth + data.noShowsThisMonth
  const rate = ratePct(data.closedThisMonth, attempts)
  const openLead = (id: string) => navigate(`/leads/${id}`)

  return (
    <div className="stats-page">
      <Header firstName={firstName} role="Closer" />
      <StatGrid>
        <StatCard label="Closings prévus" value={data.closingsToday.length} caption="Aujourd'hui" onClick={() => navigate('/closing')} />
        <StatCard label="Closés ce mois" value={data.closedThisMonth} highlight />
        <StatCard label="CA généré" value={formatEuro(data.revenueThisMonth)} caption="Deals du mois où tu es closer" />
        <StatCard label="Taux closing" value={rate !== null ? `${rate} %` : '—'} caption={`${formatNumber(data.noShowsThisMonth)} no-show${data.noShowsThisMonth > 1 ? 's' : ''} ce mois`} />
      </StatGrid>

      <div className="stats-grid-2">
        <TableCard title="Mes closings du jour">
          {data.closingsToday.length === 0 ? (
            <EmptyState title="Aucun closing prévu aujourd'hui" />
          ) : (
            <table className="ds-table">
              <tbody>
                {data.closingsToday.map((c) => {
                  const hb = c.handoff_brief
                  const briefParts = hb
                    ? [
                        hb.objective && `Objectif : ${hb.objective}`,
                        hb.budget && `Budget : ${hb.budget}`,
                        hb.objections && `Objections : ${hb.objections}`,
                        hb.availability && `Dispo : ${hb.availability}`,
                      ].filter(Boolean)
                    : []
                  return (
                    <tr key={c.id} className="ds-row-clickable" onClick={() => c.lead && openLead(c.lead.id)}>
                      <td className="ds-num-cell" style={{ textAlign: 'left', width: 70 }}>
                        <span className="ds-num">{timeOf(c.scheduled_at)}</span>
                      </td>
                      <td>
                        <div className="ds-contact-name">{c.lead ? `${c.lead.first_name} ${c.lead.last_name}` : 'Lead inconnu'}</div>
                        {briefParts.length > 0 ? <div className="ds-muted">{briefParts.join(' · ')}</div> : c.notes ? <div className="ds-muted dash-ellipsis">Brief : {c.notes}</div> : null}
                      </td>
                      <td>
                        <span className="ds-muted">{callOutcomeLabel(c.outcome)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </TableCard>

        <TableCard title="Mon pipeline" subtitle="Leads en phase closing">
          {data.pipeline.length === 0 ? (
            <EmptyState title="Aucun lead en pipeline closing" />
          ) : (
            <table className="ds-table">
              <tbody>
                {data.pipeline.map((l) => {
                  const s = statusEntry(l.status)
                  return (
                    <tr key={l.id} className="ds-row-clickable" onClick={() => openLead(l.id)}>
                      <td>
                        <div className="ds-contact-name">
                          {l.first_name} {l.last_name}
                        </div>
                        <div className="ds-muted">{l.phone || l.email || '—'}</div>
                      </td>
                      <td>
                        <StatusPill label={s.label} color={s.color} bg={s.bg} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </TableCard>
      </div>
    </div>
  )
}
