import { describe, expect, it } from 'vitest'
import { bucketSeries, inWindow, niceMax, pctDelta, periodWindows, ratePct } from '../metrics'
import { computePeriodFigures, countBySource } from '../stats-compute'
import type { CallWithLead, DealWithLead } from '../../crm/types'

const now = new Date('2026-09-25T12:00:00Z')

describe('periodWindows', () => {
  it('builds current and previous rolling windows', () => {
    const { current, previous } = periodWindows(7, now)
    expect(current!.to).toEqual(now)
    expect(now.getTime() - current!.from.getTime()).toBe(7 * 86_400_000)
    expect(previous!.to).toEqual(current!.from)
    expect(current!.from.getTime() - previous!.from.getTime()).toBe(7 * 86_400_000)
  })
  it('has no windows for "Tout"', () => {
    expect(periodWindows(0, now)).toEqual({ current: null, previous: null })
  })
})

describe('pctDelta / ratePct', () => {
  it('follows the web rule', () => {
    expect(pctDelta(150, 100)).toBe(50)
    expect(pctDelta(50, 100)).toBe(-50)
    expect(pctDelta(0, 0)).toBe(0)
    expect(pctDelta(5, 0)).toBeNull()
    expect(pctDelta(null, 3)).toBeNull()
  })
  it('returns null when denominator is 0', () => {
    expect(ratePct(1, 0)).toBeNull()
    expect(ratePct(1, 3)).toBe(33)
  })
})

describe('inWindow', () => {
  const w = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-10T00:00:00Z') }
  it('is half-open', () => {
    expect(inWindow('2026-09-01T00:00:00Z', w)).toBe(true)
    expect(inWindow('2026-09-10T00:00:00Z', w)).toBe(false)
    expect(inWindow(null, w)).toBe(false)
    expect(inWindow('2020-01-01T00:00:00Z', null)).toBe(true)
  })
})

describe('bucketSeries', () => {
  it('zero-fills days', () => {
    const from = new Date(2026, 8, 1, 10)
    const to = new Date(2026, 8, 4, 10)
    const s = bucketSeries([{ at: new Date(2026, 8, 2, 9).toISOString() }, { at: new Date(2026, 8, 2, 18).toISOString() }], from, to)
    expect(s.granularity).toBe('day')
    expect(s.points.map((p) => p.value)).toEqual([0, 2, 0, 0])
  })
  it('switches to months on long spans', () => {
    const s = bucketSeries([{ at: new Date(2026, 0, 15).toISOString() }], new Date(2025, 10, 1), new Date(2026, 8, 1))
    expect(s.granularity).toBe('month')
    expect(s.points).toHaveLength(11)
    expect(s.points.reduce((a, p) => a + p.value, 0)).toBe(1)
  })
})

describe('niceMax', () => {
  it('rounds to 1/2/5 × 10^n', () => {
    expect(niceMax(7)).toBe(10)
    expect(niceMax(130)).toBe(200)
    expect(niceMax(0)).toBe(1)
  })
})

function call(p: Partial<CallWithLead>): CallWithLead {
  return { id: 'c', workspace_id: 'w', lead_id: 'l1', type: 'setting', scheduled_at: now.toISOString(), outcome: 'pending', notes: null, attempt_number: 1, reached: false, duration_seconds: null, closer_id: null, assigned_to: null, created_at: now.toISOString(), lead: { id: 'l1', first_name: 'A', last_name: 'B', phone: '', email: null, status: 'nouveau' }, ...p }
}
function deal(p: Partial<DealWithLead>): DealWithLead {
  return { id: 'd', workspace_id: 'w', lead_id: 'l1', setter_id: null, closer_id: null, amount: 1000, cash_collected: 500, installments: 1, duration_months: null, started_at: now.toISOString(), ends_at: null, status: 'active', notes: null, created_at: now.toISOString(), updated_at: now.toISOString(), lead: null, ...p }
}

describe('computePeriodFigures', () => {
  it('matches the web stats definitions', () => {
    const window = { from: new Date('2026-09-20T00:00:00Z'), to: new Date('2026-09-26T00:00:00Z') }
    const f = computePeriodFigures({
      window,
      leadsCount: 10,
      closedCount: 1,
      calls: [
        call({ lead_id: 'l1', type: 'setting' }),
        call({ lead_id: 'l1', type: 'setting' }),
        call({ lead_id: 'l2', type: 'closing' }),
        call({ lead_id: 'l3', type: 'setting', created_at: '2026-09-01T00:00:00Z' }),
      ],
      deals: [deal({}), deal({ started_at: '2026-01-01T00:00:00Z' })],
    })
    expect(f.booked).toBe(3)
    expect(f.bookingRate).toBe(30)
    expect(f.winRate).toBe(33)
    expect(f.settingLeads).toBe(1)
    expect(f.closingLeads).toBe(1)
    expect(f.revenue).toBe(1000)
    expect(f.cash).toBe(500)
  })
  it('counts sources', () => {
    expect(countBySource([{ source: 'manuel' }, { source: 'funnel' }, { source: 'manuel' }])).toEqual([
      { source: 'manuel', count: 2 },
      { source: 'funnel', count: 1 },
    ])
  })
})
