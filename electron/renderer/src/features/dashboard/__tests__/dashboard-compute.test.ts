import { describe, expect, it } from 'vitest'
import { buildDayPlan, computeCohortFunnel, computeKpis, computeRecentBookings, countdownLabel, pickNextBooking } from '../dashboard-compute'
import type { CallWithLead, DealWithLead } from '../../crm/types'
import type { BookingRow } from '../../stats/stats-api'

const now = new Date('2026-09-25T12:00:00Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString()
const lead = { id: 'l1', first_name: 'Jean', last_name: 'Dupont', phone: '', email: null, status: 'nouveau' as const }

function call(p: Partial<CallWithLead>): CallWithLead {
  return { id: 'c', workspace_id: 'w', lead_id: 'l1', type: 'closing', scheduled_at: ago(1), outcome: 'done', notes: null, attempt_number: 1, reached: true, duration_seconds: null, closer_id: null, assigned_to: null, created_at: ago(2), lead, ...p }
}
function deal(p: Partial<DealWithLead>): DealWithLead {
  return { id: 'd', workspace_id: 'w', lead_id: 'l1', setter_id: null, closer_id: null, amount: 2000, cash_collected: 1000, installments: 1, duration_months: null, started_at: ago(1), ends_at: null, status: 'active', notes: null, created_at: ago(1), updated_at: ago(1), lead: null, ...p }
}
function booking(p: Partial<BookingRow>): BookingRow {
  return { id: 'b', calendar_id: null, lead_id: 'l1', call_id: null, title: 'RDV', scheduled_at: ago(-1), duration_minutes: 30, status: 'confirmed', source: 'booking_page', meet_url: null, is_personal: false, created_at: ago(1), booking_calendar: null, lead: { id: 'l1', first_name: 'Jean', last_name: 'Dupont', phone: null, email: null }, location: null, ...p }
}

describe('computeKpis', () => {
  it('computes cash, show and close rates with deltas', () => {
    const current = { from: new Date(now.getTime() - 7 * DAY), to: now }
    const previous = { from: new Date(now.getTime() - 14 * DAY), to: current.from }
    const k = computeKpis({
      now,
      current,
      previous,
      deals: [deal({}), deal({ created_at: ago(10), cash_collected: 500 }), deal({ status: 'churned', amount: 999 })],
      pastCalls: [
        call({}),
        call({ outcome: 'no_show' }),
        call({ outcome: 'pending' }),
        call({ scheduled_at: ago(10) }),
        call({ scheduled_at: ago(10), outcome: 'no_show' }),
      ],
    })
    expect(k.cash.current).toBe(2000)
    expect(k.cash.delta).toBe(300)
    expect(k.showRate.current).toBe(50)
    expect(k.showRate.delta).toBe(0)
    expect(k.showCounts).toEqual({ showed: 1, total: 2 })
    expect(k.closeRate.current).toBe(100)
    expect(k.pipeline).toBe(4000)
    expect(k.cash.sparkline).toHaveLength(14)
  })
})

describe('pickNextBooking', () => {
  it('skips personal, google_sync, cancelled and lead-less bookings', () => {
    const rows = [
      booking({ id: 'p', is_personal: true, scheduled_at: ago(-0.1) }),
      booking({ id: 'g', source: 'google_sync', scheduled_at: ago(-0.2) }),
      booking({ id: 'x', status: 'cancelled', scheduled_at: ago(-0.3) }),
      booking({ id: 'n', lead_id: null, lead: null, scheduled_at: ago(-0.4) }),
      booking({ id: 'ok', scheduled_at: ago(-0.5) }),
      booking({ id: 'past', scheduled_at: ago(0.5) }),
    ]
    expect(pickNextBooking(rows, now)?.id).toBe('ok')
  })
})

describe('buildDayPlan', () => {
  it('orders bookings, then overdue follow-ups, then no-shows', () => {
    const plan = buildDayPlan({
      now,
      todayBookings: [booking({ scheduled_at: new Date(now.getTime() + 3600_000).toISOString() }), booking({ id: 'old', scheduled_at: ago(0.1) })],
      overdueFollowUps: [{ id: 'f', workspace_id: 'w', lead_id: 'l1', reason: '', scheduled_at: ago(3), channel: 'email', status: 'en_attente', notes: null, created_at: ago(5), lead: { ...lead, phone: '', assigned_to: null } }],
      noShows: [call({ outcome: 'no_show' })],
    })
    expect(plan.map((p) => p.type)).toEqual(['booking', 'overdue_followup', 'no_show'])
    expect(plan[1].context).toBe('Relance en retard 3j')
  })
})

describe('computeCohortFunnel', () => {
  it('counts unique cohort leads per stage', () => {
    const f = computeCohortFunnel({
      leadIds: ['l1', 'l2', 'l3'],
      bookings: [booking({ lead_id: 'l1' }), booking({ lead_id: 'l1' }), booking({ lead_id: 'l2', status: 'cancelled' }), booking({ lead_id: 'zz' })],
      doneCalls: [call({ lead_id: 'l1' })],
      deals: [deal({ lead_id: 'l1' }), deal({ lead_id: 'l3', status: 'refunded' })],
    })
    expect(f).toEqual({ leads: 3, booked: 1, showed: 1, closed: 1 })
  })
})

describe('computeRecentBookings', () => {
  it('keeps CRM bookings created in the last 7 days', () => {
    const r = computeRecentBookings(
      [booking({ id: 'a', created_at: ago(0.01) }), booking({ id: 'b', created_at: ago(8) }), booking({ id: 'c', source: 'google_sync' }), booking({ id: 'd', created_at: ago(2) })],
      now,
    )
    expect(r.bookings.map((b) => b.id)).toEqual(['a', 'd'])
    expect(r.count7d).toBe(2)
  })
})

describe('countdownLabel', () => {
  it('formats relative time', () => {
    expect(countdownLabel(new Date(now.getTime() + 30 * 60_000).toISOString(), now)).toBe('dans 30 min')
    expect(countdownLabel(new Date(now.getTime() + 90 * 60_000).toISOString(), now)).toBe('dans 1h30')
    expect(countdownLabel(ago(1), now)).toBe('maintenant')
  })
})
