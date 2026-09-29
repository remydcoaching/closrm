// Stats KPIs — same definitions as the web's src/lib/stats/queries.ts:
//  • Leads totaux     = leads created in the window
//  • Calls bookés     = rows of `calls` created in the window (every row is a booked RDV)
//  • Taux de booking  = calls bookés / leads
//  • Deals closés     = leads status 'clos' updated in the window
//  • Win rate         = deals closés / calls bookés
//  • Funnel           = Leads → distinct leads with a setting call → with a closing call → closés
// Added (Insyder-style): CA signé / cash collecté from deals started in the
// window, and the same figures for the previous window to drive deltas.
import type { CallWithLead, DealWithLead } from '../crm/types'
import { distinctCount, inWindow, ratePct, sumBy, type TimeWindow } from './metrics'

export interface PeriodFigures {
  leads: number
  booked: number
  bookingRate: number | null
  closed: number
  winRate: number | null
  settingLeads: number
  closingLeads: number
  revenue: number
  cash: number
  dealsCount: number
}

export function computePeriodFigures(input: {
  window: TimeWindow | null
  leadsCount: number
  closedCount: number
  calls: CallWithLead[]
  deals: DealWithLead[]
}): PeriodFigures {
  const calls = input.calls.filter((c) => inWindow(c.created_at, input.window))
  const deals = input.deals.filter((d) => inWindow(d.started_at, input.window))
  const booked = calls.length
  return {
    leads: input.leadsCount,
    booked,
    bookingRate: ratePct(booked, input.leadsCount),
    closed: input.closedCount,
    winRate: ratePct(input.closedCount, booked),
    settingLeads: distinctCount(calls.filter((c) => c.type === 'setting'), (c) => c.lead_id),
    closingLeads: distinctCount(calls.filter((c) => c.type === 'closing'), (c) => c.lead_id),
    revenue: sumBy(deals, (d) => d.amount),
    cash: sumBy(deals, (d) => d.cash_collected),
    dealsCount: deals.length,
  }
}

/** Counts per source key, sorted desc. */
export function countBySource<T extends { source: string }>(rows: T[]): { source: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.source, (m.get(r.source) ?? 0) + 1)
  return Array.from(m, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count)
}
