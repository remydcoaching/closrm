// Pure transforms reproducing src/lib/dashboard/v2-queries.ts (the web's
// admin "command center") from rows returned by the existing list endpoints.
// Kept free of fetches so each rule can be unit-tested.
import type { CallWithLead, DealWithLead, FollowUpWithLead } from '../crm/types'
import type { BookingRow } from '../stats/stats-api'
import { dayKey, inWindow, pctDelta, ratePct, sumBy, type TimeWindow } from '../stats/metrics'

export interface KpiFigure {
  current: number | null
  delta: number | null
  sparkline: number[]
}

export interface DashboardKpis {
  cash: KpiFigure
  showRate: KpiFigure
  closeRate: KpiFigure
  pipeline: number
  showCounts: { showed: number; total: number }
  dealsClosed: number
}

/**
 * Web rules (fetchKpisV2):
 *  • cash collecté = Σ deals.cash_collected, deals.created_at in window
 *  • show rate     = calls "présents" / calls passés avec un résultat, scheduled_at in window
 *  • close rate    = deals status active créés dans la fenêtre / calls présents
 *  • pipeline      = Σ amount des deals actifs
 * Web bug NOT reproduced: it matches outcomes 'fait'|'closed'|'present',
 * which don't exist (CallOutcome = pending|done|cancelled|no_show), so its
 * show/close rates are always 0. Here "présent" = outcome 'done', and
 * "avec un résultat" = outcome ≠ 'pending'.
 * Close-rate delta is computed too (the web leaves it null) because the
 * previous window uses the exact same data.
 */
export function computeKpis(input: {
  deals: DealWithLead[]
  pastCalls: CallWithLead[]
  current: TimeWindow
  previous: TimeWindow
  now: Date
}): DashboardKpis {
  const { deals, pastCalls, current, previous, now } = input
  const dealsCur = deals.filter((d) => inWindow(d.created_at, current))
  const dealsPrev = deals.filter((d) => inWindow(d.created_at, previous))
  const cashCur = sumBy(dealsCur, (d) => d.cash_collected)
  const cashPrev = sumBy(dealsPrev, (d) => d.cash_collected)

  const rate = (w: TimeWindow) => {
    const calls = pastCalls.filter((c) => inWindow(c.scheduled_at, w))
    const withOutcome = calls.filter((c) => c.outcome !== 'pending')
    const showed = withOutcome.filter((c) => c.outcome === 'done').length
    return { showed, total: withOutcome.length }
  }
  const showCur = rate(current)
  const showPrev = rate(previous)
  const showRateCur = ratePct(showCur.showed, showCur.total)
  const showRatePrev = ratePct(showPrev.showed, showPrev.total)

  const closedCur = dealsCur.filter((d) => d.status === 'active').length
  const closedPrev = dealsPrev.filter((d) => d.status === 'active').length
  const closeRateCur = ratePct(closedCur, showCur.showed)
  const closeRatePrev = ratePct(closedPrev, showPrev.showed)

  return {
    cash: { current: cashCur, delta: pctDelta(cashCur, cashPrev), sparkline: cashSparkline(deals, now) },
    showRate: { current: showRateCur, delta: pctDelta(showRateCur, showRatePrev), sparkline: [] },
    closeRate: { current: closeRateCur, delta: pctDelta(closeRateCur, closeRatePrev), sparkline: [] },
    pipeline: sumBy(
      deals.filter((d) => d.status === 'active'),
      (d) => d.amount,
    ),
    showCounts: showCur,
    dealsClosed: closedCur,
  }
}

/** 14 daily points of cash collected (deals.created_at), oldest first. */
export function cashSparkline(deals: DealWithLead[], now: Date, days = 14): number[] {
  const byDay = new Map<string, number>()
  for (const d of deals) {
    const k = dayKey(new Date(d.created_at))
    byDay.set(k, (byDay.get(k) ?? 0) + Number(d.cash_collected ?? 0))
  }
  const out: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(byDay.get(dayKey(d)) ?? 0)
  }
  return out
}

// ─── Next booking / day plan ────────────────────────────────────────────────

/** getNextBooking(): first future CRM booking with a lead (no google_sync, no personal, not cancelled). */
export function pickNextBooking(rows: BookingRow[], now: Date): BookingRow | null {
  return (
    rows
      .filter((b) => new Date(b.scheduled_at).getTime() >= now.getTime() && b.status !== 'cancelled' && b.source !== 'google_sync' && !b.is_personal && b.lead_id && b.lead)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null
  )
}

export interface DayPlanItem {
  type: 'booking' | 'overdue_followup' | 'no_show'
  leadId: string
  leadName: string
  context: string
  scheduledAt?: string
  priority: number
}

function fullName(l: { first_name: string; last_name: string }): string {
  return `${l.first_name} ${l.last_name}`.trim() || 'Sans nom'
}

/** getDayPlan(): today's remaining bookings, 3 overdue follow-ups, 2 recent no-shows — max 7. */
export function buildDayPlan(input: { todayBookings: BookingRow[]; overdueFollowUps: FollowUpWithLead[]; noShows: CallWithLead[]; now: Date }): DayPlanItem[] {
  const { now } = input
  const items: DayPlanItem[] = []
  for (const b of input.todayBookings) {
    if (!b.lead || b.status === 'cancelled') continue
    if (new Date(b.scheduled_at).getTime() < now.getTime()) continue
    const time = new Date(b.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    items.push({ type: 'booking', leadId: b.lead.id, leadName: fullName(b.lead), context: `RDV ${time}`, scheduledAt: b.scheduled_at, priority: 1 })
  }
  for (const f of input.overdueFollowUps) {
    if (!f.lead) continue
    const days = Math.max(1, Math.floor((now.getTime() - new Date(f.scheduled_at).getTime()) / 86_400_000))
    items.push({ type: 'overdue_followup', leadId: f.lead.id, leadName: fullName(f.lead), context: `Relance en retard ${days}j`, priority: 2 })
  }
  for (const c of input.noShows) {
    if (!c.lead) continue
    items.push({ type: 'no_show', leadId: c.lead.id, leadName: fullName(c.lead), context: 'No-show à reprogrammer', priority: 3 })
  }
  return items
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
      const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
      if (at && bt) return at - bt
      return a.leadName.localeCompare(b.leadName)
    })
    .slice(0, 7)
}

// ─── Funnel (cohort of leads created in the window) ─────────────────────────

export interface CohortFunnel {
  leads: number
  booked: number
  showed: number
  closed: number
}

/** getFunnelData(): unique cohort leads that booked (non-cancelled), showed (call done), closed (active deal). */
export function computeCohortFunnel(input: { leadIds: string[]; bookings: BookingRow[]; doneCalls: CallWithLead[]; deals: DealWithLead[] }): CohortFunnel {
  const cohort = new Set(input.leadIds)
  const uniq = (ids: (string | null)[]) => new Set(ids.filter((id): id is string => !!id && cohort.has(id))).size
  return {
    leads: cohort.size,
    booked: uniq(input.bookings.filter((b) => b.status !== 'cancelled').map((b) => b.lead_id)),
    showed: uniq(input.doneCalls.filter((c) => c.outcome === 'done').map((c) => c.lead_id)),
    closed: uniq(input.deals.filter((d) => d.status === 'active').map((d) => d.lead_id)),
  }
}

// ─── Recent bookings ────────────────────────────────────────────────────────

export interface RecentBookings {
  countToday: number
  count7d: number
  bookings: BookingRow[]
}

/** getRecentBookings(): CRM bookings CREATED in the last 7 days, newest first, 15 shown. */
export function computeRecentBookings(rows: BookingRow[], now: Date): RecentBookings {
  const since = now.getTime() - 7 * 86_400_000
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const recent = rows
    .filter((b) => new Date(b.created_at).getTime() >= since && b.status !== 'cancelled' && b.source !== 'google_sync' && !b.is_personal)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return {
    countToday: recent.filter((b) => new Date(b.created_at).getTime() >= todayStart.getTime()).length,
    count7d: recent.length,
    bookings: recent.slice(0, 15),
  }
}

// ─── Priority leads ─────────────────────────────────────────────────────────

export function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
}

export function hotContext(iso: string, now: Date): string {
  const hrs = Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000))
  return hrs < 24 ? `Actif il y a ${hrs}h` : `Actif il y a ${Math.floor(hrs / 24)}j`
}

/** Countdown label of NextCallCard. */
export function countdownLabel(targetIso: string, now: Date): string {
  const diff = new Date(targetIso).getTime() - now.getTime()
  if (diff <= 0) return 'maintenant'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `dans ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `dans ${hrs}h${String(mins % 60).padStart(2, '0')}`
  const days = Math.floor(hrs / 24)
  return `dans ${days} jour${days > 1 ? 's' : ''}`
}
