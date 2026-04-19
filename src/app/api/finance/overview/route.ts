import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export interface FinanceOverviewResponse {
  mrr_current: number
  mrr_new_this_month: number
  mrr_churned_this_month: number
  cash_this_month: number
  cash_cumulative: number
  revenue_cumulative: number
  deals_active: number
  avg_deal_size: number
  mrr_by_month: { month: string; mrr: number }[]
}

// Compute MRR contribution of a deal at a given ISO date.
// MRR = amount / duration_months if the deal is active at that date, else 0.
function dealMrrAt(
  deal: { amount: number; duration_months: number | null; started_at: string; ends_at: string | null; status: string },
  atIso: string,
): number {
  if (!deal.duration_months || deal.duration_months <= 0) return 0
  if (deal.status !== 'active') return 0
  const at = new Date(atIso).getTime()
  const start = new Date(deal.started_at).getTime()
  const end = deal.ends_at ? new Date(deal.ends_at).getTime() : Infinity
  if (at < start || at > end) return 0
  return deal.amount / deal.duration_months
}

export async function GET(_request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data: deals, error } = await supabase
      .from('deals')
      .select('amount, cash_collected, duration_months, started_at, ends_at, status')
      .eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const all = deals ?? []

    const now = new Date()
    const nowIso = now.toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    let mrr_current = 0
    let mrr_last_month = 0
    let mrr_new_this_month = 0
    let cash_this_month = 0
    let cash_cumulative = 0
    let revenue_cumulative = 0
    let deals_active = 0
    let deals_active_total = 0

    for (const d of all) {
      mrr_current += dealMrrAt(d, nowIso)
      mrr_last_month += dealMrrAt(d, lastMonthStart)
      cash_cumulative += Number(d.cash_collected ?? 0)
      revenue_cumulative += Number(d.amount ?? 0)

      const started = new Date(d.started_at).getTime()
      if (started >= new Date(monthStart).getTime()) {
        cash_this_month += Number(d.cash_collected ?? 0)
        mrr_new_this_month += dealMrrAt({ ...d, status: 'active' }, nowIso)
      }

      if (d.status === 'active') {
        const end = d.ends_at ? new Date(d.ends_at).getTime() : Infinity
        if (end >= now.getTime()) {
          deals_active += 1
        }
        deals_active_total += 1
      }
    }

    const mrr_churned_this_month = Math.max(0, mrr_last_month - mrr_current + mrr_new_this_month)

    // MRR historique par mois (12 derniers mois)
    const mrr_by_month: { month: string; mrr: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const iso = d.toISOString()
      let sum = 0
      for (const deal of all) sum += dealMrrAt(deal, iso)
      mrr_by_month.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        mrr: Math.round(sum * 100) / 100,
      })
    }

    const avg_deal_size = deals_active_total > 0
      ? revenue_cumulative / all.length
      : 0

    const response: FinanceOverviewResponse = {
      mrr_current: Math.round(mrr_current * 100) / 100,
      mrr_new_this_month: Math.round(mrr_new_this_month * 100) / 100,
      mrr_churned_this_month: Math.round(mrr_churned_this_month * 100) / 100,
      cash_this_month: Math.round(cash_this_month * 100) / 100,
      cash_cumulative: Math.round(cash_cumulative * 100) / 100,
      revenue_cumulative: Math.round(revenue_cumulative * 100) / 100,
      deals_active,
      avg_deal_size: Math.round(avg_deal_size * 100) / 100,
      mrr_by_month,
    }

    return NextResponse.json({ data: response })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('finance overview', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
