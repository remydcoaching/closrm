// Dashboard — mirror of the web's src/app/(dashboard)/dashboard/page.tsx:
//  • admin   → "command center" v2 (dashboard-client-v2.tsx): prochain RDV,
//              plan du jour, KPIs (cash, show rate, close rate, pipeline),
//              leads à risque / chauds, funnel de conversion, réservations
//              récentes — plus agenda du jour et relances du jour/en retard.
//  • setter  → SetterDashboard.tsx, closer → CloserDashboard.tsx
//  • monteur → the web redirects to /montage (web-only module).
// Role comes from GET /api/user/profile + GET /api/workspaces/members.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/api-client'
import { openWeb } from '../../lib/web-link'
import { safeExternalUrl } from '../../lib/safe-url'
import { StatCard, StatGrid, formatNumber } from '../../design-system/StatCard'
import { TableCard } from '../../design-system/TableCard'
import { Chips } from '../../design-system/Tabs'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { Button } from '../../design-system/Button'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { followUpChannelLabel, relativeTime, statusEntry } from '../leads/status'
import { fetchCurrentMember, type BookingRow, type CurrentMember } from '../stats/stats-api'
import { formatEuro, startOfDay, type StatsPeriod } from '../stats/metrics'
import { FunnelSteps, Sparkline } from '../stats/charts'
import { countdownLabel } from './dashboard-compute'
import { loadAdminDashboard, type AdminDashboardData, type PriorityLead } from './dashboard-api'
import { BriefModal } from './BriefModal'
import { SetterDashboard, CloserDashboard } from './TeamDashboards'
import './dashboard.css'
import '../stats/stats.css'
import { useCachedQuery } from '../../lib/use-cached-query'

const PERIODS: { key: string; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
]

export function DashboardPage() {
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setMember(await fetchCurrentMember())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error)
    return (
      <div className="stats-page">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  if (!member)
    return (
      <div className="stats-page">
        <LoadingState />
      </div>
    )

  const firstName = member.fullName?.split(' ')[0] || 'Coach'
  if (member.role === 'setter') return <SetterDashboard firstName={firstName} userId={member.userId} />
  if (member.role === 'closer') return <CloserDashboard firstName={firstName} userId={member.userId} />
  if (member.role === 'monteur') {
    return (
      <div className="stats-page">
        <EmptyState title="Espace Montage" description="Ton rôle de monteur donne accès au module Montage, disponible sur l'app web." />
        <div>
          <Button variant="primary" onClick={() => openWeb('/montage')}>
            Ouvrir le module Montage
          </Button>
        </div>
      </div>
    )
  }
  return <AdminDashboard firstName={firstName} />
}

function AdminDashboard({ firstName }: { firstName: string }) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Exclude<StatsPeriod, 0>>(30)
  const [brief, setBrief] = useState<{ leadId: string; bookingId: string | null; leadName: string } | null>(null)

  // Cache first: a revisit shows the last command center instantly and
  // refreshes it in the background.
  const query = useCachedQuery<AdminDashboardData>(`desktop:dashboard:${period}`, {
    screen: 'Dashboard',
    staleMs: 30_000,
    fetcher: () => loadAdminDashboard(period),
  })
  const data = query.data ?? null
  const error = query.error
  const load = query.refresh

  const openLead = (id: string) => navigate(`/leads/${id}`)

  return (
    <div className="stats-page">
      <div className="stats-page-header">
        <div>
          <h1>Bonjour, {firstName} 👋</h1>
          <p>Voici votre command center</p>
        </div>
        <Chips items={PERIODS} active={String(period)} onChange={(k) => setPeriod(Number(k) as Exclude<StatsPeriod, 0>)} />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <LoadingState label="Chargement du command center…" />
      ) : (
        <>
          <div className="dash-hero">
            <NextCallCard booking={data.nextBooking} onLead={openLead} onBrief={(b) => b.lead && setBrief({ leadId: b.lead.id, bookingId: b.id, leadName: `${b.lead.first_name} ${b.lead.last_name}` })} />
            <DayPlanCard data={data} onLead={openLead} />
          </div>

          <StatGrid>
            <StatCard
              label="Cash collecté"
              value={
                <span className="dash-kpi-value">
                  {formatEuro(data.kpis.cash.current ?? 0)}
                  <Sparkline values={data.kpis.cash.sparkline} />
                </span>
              }
              delta={data.kpis.cash.delta}
              caption={`Deals créés sur ${period} jours`}
              highlight
            />
            <StatCard
              label="Show rate"
              value={data.kpis.showRate.current !== null ? `${data.kpis.showRate.current} %` : '—'}
              delta={data.kpis.showRate.delta}
              caption={`${formatNumber(data.kpis.showCounts.showed)} présents / ${formatNumber(data.kpis.showCounts.total)} calls passés avec résultat`}
            />
            <StatCard
              label="Close rate"
              value={data.kpis.closeRate.current !== null ? `${data.kpis.closeRate.current} %` : '—'}
              delta={data.kpis.closeRate.delta}
              caption={`${formatNumber(data.kpis.dealsClosed)} deals actifs / ${formatNumber(data.kpis.showCounts.showed)} présents`}
            />
            <StatCard label="Pipeline" value={formatEuro(data.kpis.pipeline)} caption="Montant total des deals actifs" onClick={() => navigate('/deals')} />
          </StatGrid>

          <div className="stats-grid-2">
            <PriorityCard title="Leads à risque" tone="warning" emptyLabel="Aucun lead à risque ✨" leads={data.riskLeads} onLead={openLead} />
            <PriorityCard title="Leads chauds" tone="hot" emptyLabel="Aucun lead chaud actuellement" leads={data.hotLeads} onLead={openLead} />
          </div>

          <section className="stats-card">
            <header className="stats-card-header">
              <div>
                <h2>Funnel de conversion</h2>
                <p>Cohorte des leads créés sur {period} jours</p>
              </div>
              <span className="dash-global-conv">
                Conversion globale : <strong>{data.funnel.leads > 0 ? `${Math.round((data.funnel.closed / data.funnel.leads) * 100)} %` : '—'}</strong>
              </span>
            </header>
            {data.funnelPartial && <div className="stats-notice stats-notice--warning">Volume très élevé : funnel calculé sur une partie des données.</div>}
            <FunnelSteps
              stages={[
                { key: 'leads', label: 'Leads', value: data.funnel.leads, color: 'var(--color-info)', onClick: () => navigate('/leads') },
                { key: 'book', label: 'Bookés', value: data.funnel.booked, color: '#8b5cf6' },
                { key: 'show', label: 'Présents', value: data.funnel.showed, color: '#ec4899', onClick: () => navigate('/closing') },
                { key: 'close', label: 'Closés', value: data.funnel.closed, color: 'var(--color-success)', onClick: () => navigate('/deals') },
              ]}
            />
          </section>

          <div className="stats-grid-2">
            <TodayAgenda bookings={data.todayBookings} onLead={openLead} />
            <FollowUpsCard data={data} onLead={openLead} onOpenAll={() => navigate('/relances')} />
          </div>

          <RecentBookingsTable data={data} onLead={openLead} />
        </>
      )}

      {brief && <BriefModal leadId={brief.leadId} bookingId={brief.bookingId} leadName={brief.leadName} onClose={() => setBrief(null)} />}
    </div>
  )
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function NextCallCard({ booking, onLead, onBrief }: { booking: BookingRow | null; onLead: (id: string) => void; onBrief: (b: BookingRow) => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!booking || !booking.lead) {
    return (
      <section className="stats-card dash-hero-card">
        <div className="dash-eyebrow">Prochain RDV</div>
        <div className="dash-next-name">🎯 À jour</div>
        <p className="ds-muted">Aucun RDV à venir planifié.</p>
      </section>
    )
  }
  const target = new Date(booking.scheduled_at)
  const isToday = target.toDateString() === now.toDateString()
  const dateLabel = isToday ? `Aujourd'hui ${timeOf(booking.scheduled_at)}` : `${target.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })} · ${timeOf(booking.scheduled_at)}`
  const meet = safeExternalUrl(booking.meet_url)
  const lead = booking.lead
  return (
    <section className="stats-card dash-hero-card">
      <div className="dash-eyebrow">Prochain RDV</div>
      <div className="dash-next-name">
        {lead.first_name} {lead.last_name}
      </div>
      <div className="dash-next-when">
        {dateLabel} · {countdownLabel(booking.scheduled_at, now)}
      </div>
      <div className="dash-next-meta">
        {booking.booking_calendar?.name && <span>📅 {booking.booking_calendar.name}</span>}
        {booking.location?.name && <span>📍 {booking.location.name}</span>}
        {lead.email && <span>✉ {lead.email}</span>}
        {lead.phone && <span>☎ {lead.phone}</span>}
      </div>
      <div className="dash-next-actions">
        {meet && (
          <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={() => window.closrm?.openExternal(meet)}>
            Rejoindre Meet
          </button>
        )}
        <button type="button" className="ds-pill-button" onClick={() => onBrief(booking)}>
          ✨ Générer brief IA
        </button>
        <button type="button" className="ds-pill-button" onClick={() => onLead(lead.id)}>
          Fiche lead
        </button>
      </div>
    </section>
  )
}

const PLAN_ICONS: Record<string, string> = { booking: '📅', overdue_followup: '⏰', no_show: '↻' }

function DayPlanCard({ data, onLead }: { data: AdminDashboardData; onLead: (id: string) => void }) {
  return (
    <section className="stats-card dash-hero-card">
      <div className="dash-eyebrow">Plan du jour</div>
      {data.dayPlan.length === 0 ? (
        <p className="ds-muted">Rien d'urgent aujourd'hui ✨</p>
      ) : (
        <ol className="dash-list">
          {data.dayPlan.map((item, i) => (
            <li key={`${item.type}-${item.leadId}-${i}`}>
              <button type="button" className={`dash-list-item dash-list-item--${item.type}`} onClick={() => onLead(item.leadId)}>
                <span className="dash-list-index">{i + 1}.</span>
                <span className="dash-list-icon">{PLAN_ICONS[item.type]}</span>
                <span className="dash-list-name">{item.leadName}</span>
                <span className="dash-list-context">{item.context}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function PriorityCard({ title, tone, emptyLabel, leads, onLead }: { title: string; tone: 'warning' | 'hot'; emptyLabel: string; leads: PriorityLead[]; onLead: (id: string) => void }) {
  return (
    <section className="stats-card">
      <header className="stats-card-header">
        <div>
          <h2>
            {tone === 'warning' ? '⚠ ' : '🔥 '}
            {title}
          </h2>
        </div>
        <span className="ds-muted">{leads.length}</span>
      </header>
      {leads.length === 0 ? (
        <p className="ds-muted">{emptyLabel}</p>
      ) : (
        <ul className="dash-list">
          {leads.map((l) => {
            const s = statusEntry(l.status)
            return (
              <li key={l.id}>
                <button type="button" className="dash-list-item" onClick={() => onLead(l.id)}>
                  <Avatar name={l.name} size={26} />
                  <span className="dash-list-name">{l.name}</span>
                  <StatusPill label={s.label} color={s.color} bg={s.bg} />
                  <span className={`dash-list-context dash-list-context--${tone}`}>{l.context}</span>
                  <span className="ds-muted">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  confirmed: { label: 'Confirmé', color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  completed: { label: 'Terminé', color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  no_show: { label: 'Absent', color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  cancelled: { label: 'Annulé', color: 'var(--color-text-muted)', bg: 'var(--color-bg-muted)' },
}

function TodayAgenda({ bookings, onLead }: { bookings: BookingRow[]; onLead: (id: string) => void }) {
  const navigate = useNavigate()
  const now = Date.now()
  return (
    <TableCard
      title="Agenda du jour"
      subtitle={`${formatNumber(bookings.length)} RDV aujourd'hui`}
      toolbar={
        <button type="button" className="ds-pill-button" onClick={() => navigate('/agenda')}>
          Voir l'agenda
        </button>
      }
    >
      {bookings.length === 0 ? (
        <EmptyState title="Aucun RDV aujourd'hui" />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Heure</th>
              <th>RDV</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const st = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.pending
              const past = new Date(b.scheduled_at).getTime() + b.duration_minutes * 60_000 < now
              return (
                <tr key={b.id} className={b.lead ? 'ds-row-clickable' : undefined} onClick={() => b.lead && onLead(b.lead.id)}>
                  <td className="ds-num-cell" style={{ textAlign: 'left' }}>
                    <span className="ds-num" style={{ opacity: past ? 0.5 : 1 }}>
                      {timeOf(b.scheduled_at)}
                    </span>
                    <div className="ds-muted">{b.duration_minutes} min</div>
                  </td>
                  <td>
                    <div className="ds-contact-name">{b.lead ? `${b.lead.first_name} ${b.lead.last_name}` : b.title}</div>
                    <div className="ds-muted">{[b.booking_calendar?.name, b.is_personal ? 'Perso' : null, b.source === 'google_sync' ? 'Google Agenda' : null].filter(Boolean).join(' · ') || b.title}</div>
                  </td>
                  <td>
                    <StatusPill label={st.label} color={st.color} bg={st.bg} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}

function FollowUpsCard({ data, onLead, onOpenAll }: { data: AdminDashboardData; onLead: (id: string) => void; onOpenAll: () => void }) {
  const todayStart = startOfDay(new Date()).getTime()
  const overdue = data.followUps.filter((f) => new Date(f.scheduled_at).getTime() < todayStart)
  const today = data.followUps.filter((f) => new Date(f.scheduled_at).getTime() >= todayStart)
  const cap = data.followUpsCapped ? '+' : ''
  return (
    <TableCard
      title="Relances"
      subtitle={`${formatNumber(today.length)}${cap} aujourd'hui · ${formatNumber(overdue.length)}${cap} en retard`}
      toolbar={
        <button type="button" className="ds-pill-button" onClick={onOpenAll}>
          Toutes les relances
        </button>
      }
    >
      {data.followUps.length === 0 ? (
        <EmptyState title="Aucune relance en attente" description="Rien à relancer aujourd'hui." />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Raison</th>
              <th>Canal</th>
              <th className="ds-num-cell">Prévue</th>
            </tr>
          </thead>
          <tbody>
            {data.followUps.slice(0, 12).map((f) => {
              const late = new Date(f.scheduled_at).getTime() < todayStart
              return (
                <tr key={f.id} className={`ds-row-clickable ${late ? 'ds-row--alert' : ''}`} onClick={() => f.lead && onLead(f.lead.id)}>
                  <td>
                    <div className="ds-contact-name">{f.lead ? `${f.lead.first_name} ${f.lead.last_name}` : '—'}</div>
                  </td>
                  <td className="ds-muted">{f.reason || '—'}</td>
                  <td className="ds-muted">{followUpChannelLabel(f.channel)}</td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{late ? relativeTime(f.scheduled_at) : timeOf(f.scheduled_at)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}

function formatScheduled(iso: string): string {
  const target = new Date(iso)
  const now = new Date()
  if (target.toDateString() === now.toDateString()) return `Aujourd'hui ${timeOf(iso)}`
  const tmw = new Date(now)
  tmw.setDate(tmw.getDate() + 1)
  if (target.toDateString() === tmw.toDateString()) return `Demain ${timeOf(iso)}`
  return `${target.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ${timeOf(iso)}`
}

function RecentBookingsTable({ data, onLead }: { data: AdminDashboardData; onLead: (id: string) => void }) {
  const navigate = useNavigate()
  const r = data.recent
  return (
    <TableCard
      title="Réservations récentes"
      subtitle={`${formatNumber(r.countToday)} aujourd'hui · ${formatNumber(r.count7d)} sur 7 jours`}
      toolbar={
        <button type="button" className="ds-pill-button" onClick={() => navigate('/agenda')}>
          Voir tout
        </button>
      }
    >
      {r.bookings.length === 0 ? (
        <EmptyState title="Aucune réservation sur les 7 derniers jours." />
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Source</th>
              <th>RDV prévu</th>
              <th className="ds-num-cell">Pris</th>
            </tr>
          </thead>
          <tbody>
            {r.bookings.map((b) => {
              const name = b.lead ? `${b.lead.first_name} ${b.lead.last_name}` : b.title || 'RDV'
              return (
                <tr key={b.id} className={b.lead_id ? 'ds-row-clickable' : undefined} onClick={() => b.lead_id && onLead(b.lead_id)}>
                  <td>
                    <div className="ds-contact">
                      <Avatar name={name} size={28} />
                      <div className="ds-contact-text">
                        <div className="ds-contact-name">{name}</div>
                        {b.booking_calendar?.name && <div className="ds-muted">{b.booking_calendar.name}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <BookingSourcePill source={b.source} />
                  </td>
                  <td className="ds-muted">{formatScheduled(b.scheduled_at)}</td>
                  <td className="ds-num-cell">
                    <span className="ds-num">{relativeTime(b.created_at)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </TableCard>
  )
}

/** Booking source (booking_page / manual …). The web shows the LEAD's source
 *  (joined server-side) — GET /api/bookings doesn't return it, so the
 *  booking's own origin is shown instead, never a guessed lead source. */
function BookingSourcePill({ source }: { source: string }) {
  const known: Record<string, string> = { booking_page: 'Page de réservation', manual: 'Manuel', google_sync: 'Google Agenda' }
  const label = known[source] ?? source
  return <span className="ds-muted">{label}</span>
}
