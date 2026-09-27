// Fetch layer of the admin command center. The web builds it in a Server
// Component with direct Supabase queries (src/lib/dashboard/v2-queries.ts);
// there is no /api/dashboard route, so each block is rebuilt from the
// existing list endpoints with the SAME filters.
import { api } from '../../lib/api-client'
import type { Lead, LeadsListResponse } from '../leads/types'
import type { FollowUpWithLead } from '../crm/types'
import { fetchBookings, fetchCallsScheduled, fetchDeals, fetchFollowUps, fetchLeadsInWindow, type BookingRow } from '../stats/stats-api'
import { endOfDay, startOfDay, type StatsPeriod } from '../stats/metrics'
import {
  buildDayPlan,
  computeCohortFunnel,
  computeKpis,
  computeRecentBookings,
  daysSince,
  hotContext,
  pickNextBooking,
  type CohortFunnel,
  type DashboardKpis,
  type DayPlanItem,
  type RecentBookings,
} from './dashboard-compute'

export interface PriorityLead {
  id: string
  name: string
  context: string
  status: Lead['status']
}

export interface AdminDashboardData {
  kpis: DashboardKpis
  nextBooking: BookingRow | null
  dayPlan: DayPlanItem[]
  todayBookings: BookingRow[]
  followUps: FollowUpWithLead[]
  followUpsCapped: boolean
  riskLeads: PriorityLead[]
  hotLeads: PriorityLead[]
  funnel: CohortFunnel
  funnelPartial: boolean
  recent: RecentBookings
}

const OPEN_STATUSES = 'nouveau,scripte,setting_planifie,no_show_setting,closing_planifie,no_show_closing,pas_qualifie'

/** The list endpoint returns last_activity_at: no extra request per lead. */
function withLastActivity(leads: Lead[]): { lead: Lead; lastActivity: string | null }[] {
  return leads.map((lead) => ({ lead, lastActivity: lead.last_activity_at ?? null }))
}

/** getRiskLeads(): open leads inactive for 7+ days, oldest activity first, 5 max. */
async function fetchRiskLeads(now: Date): Promise<PriorityLead[]> {
  const res = await api.get<LeadsListResponse>(`/api/leads?status=${OPEN_STATUSES}&sort=last_activity_at&order=asc&per_page=5`)
  const detailed = withLastActivity(res.data)
  return detailed
    .filter((d) => d.lastActivity && daysSince(d.lastActivity, now) >= 7)
    .map(({ lead, lastActivity }) => ({
      id: lead.id,
      name: `${lead.first_name} ${lead.last_name}`.trim() || 'Sans nom',
      context: `Inactif ${daysSince(lastActivity as string, now)}j`,
      status: lead.status,
    }))
}

/**
 * getHotLeads(): open leads active in the last 48h tagged chaud/VIP.
 * The web query also ORs `status.eq.nouveau_lead`, a status that doesn't
 * exist (it's 'nouveau') — that branch never matches, so it's omitted here.
 */
async function fetchHotLeads(now: Date): Promise<PriorityLead[]> {
  const res = await api.get<LeadsListResponse>(`/api/leads?status=${OPEN_STATUSES}&tags=chaud,VIP&sort=last_activity_at&order=desc&per_page=8`)
  const detailed = withLastActivity(res.data)
  return detailed
    .filter((d) => d.lastActivity && now.getTime() - new Date(d.lastActivity).getTime() <= 2 * 86_400_000)
    .slice(0, 5)
    .map(({ lead, lastActivity }) => ({
      id: lead.id,
      name: `${lead.first_name} ${lead.last_name}`.trim() || 'Sans nom',
      context: hotContext(lastActivity as string, now),
      status: lead.status,
    }))
}

export async function loadAdminDashboard(period: Exclude<StatsPeriod, 0>): Promise<AdminDashboardData> {
  const now = new Date()
  const since = new Date(now.getTime() - period * 86_400_000)
  const prevSince = new Date(now.getTime() - period * 2 * 86_400_000)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)

  const [deals, pastCalls, nextPaged, todayPaged, overdue, noShows, followUps, riskLeads, hotLeads, cohort, windowBookings, doneCalls] = await Promise.all([
    fetchDeals(),
    fetchCallsScheduled({ after: prevSince, before: now }),
    fetchBookings({ start: now, maxPages: 4, stopWhen: (rows) => pickNextBooking(rows, now) !== null }),
    fetchBookings({ start: todayStart, end: todayEnd, maxPages: 2 }),
    fetchFollowUps({ status: 'en_attente', scheduled_before: now.toISOString(), sort: 'scheduled_at', order: 'asc', per_page: '3' }),
    fetchCallsScheduled({ after: sevenDaysAgo, outcome: 'no_show', perPage: 2, maxPages: 1 }),
    fetchFollowUps({ status: 'en_attente', scheduled_before: todayEnd.toISOString(), sort: 'scheduled_at', order: 'asc', per_page: '100' }),
    fetchRiskLeads(now),
    fetchHotLeads(now),
    fetchLeadsInWindow({ from: since, to: now }),
    // Bookings / done calls of cohort leads: a lead created after `since`
    // can only have RDVs scheduled after `since` (the list endpoints filter
    // on scheduled_at, not lead_id). Also covers "booked in the last 7 days".
    fetchBookings({ start: since < sevenDaysAgo ? since : sevenDaysAgo, maxPages: 8 }),
    fetchCallsScheduled({ after: since, outcome: 'done' }),
  ])

  return {
    kpis: computeKpis({ deals, pastCalls: pastCalls.rows, current: { from: since, to: now }, previous: { from: prevSince, to: since }, now }),
    nextBooking: pickNextBooking(nextPaged.rows, now),
    dayPlan: buildDayPlan({ todayBookings: todayPaged.rows, overdueFollowUps: overdue.data, noShows: noShows.rows, now }),
    todayBookings: todayPaged.rows.filter((b) => b.status !== 'cancelled'),
    followUps: followUps.data,
    followUpsCapped: followUps.data.length >= 100,
    riskLeads,
    hotLeads,
    funnel: computeCohortFunnel({ leadIds: cohort.rows.map((l) => l.id), bookings: windowBookings.rows, doneCalls: doneCalls.rows, deals }),
    funnelPartial: cohort.truncated || windowBookings.truncated || doneCalls.truncated,
    recent: computeRecentBookings(windowBookings.rows, now),
  }
}

// ─── AI pre-call brief (POST /api/dashboard/brief) ──────────────────────────

export interface CallBrief {
  summary: string[]
  questions: string[]
  risks: string[]
}

export async function generateBrief(leadId: string, bookingId: string | null): Promise<{ brief: CallBrief; cached: boolean }> {
  return api.post<{ brief: CallBrief; cached: boolean }>('/api/dashboard/brief', { lead_id: leadId, booking_id: bookingId })
}
