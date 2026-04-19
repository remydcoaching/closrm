import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export interface MemberPerformance {
  user_id: string
  full_name: string
  email: string
  role: 'admin' | 'setter' | 'closer'
  deals_as_closer: number
  deals_as_setter: number
  revenue_closed: number
  cash_collected: number
  mrr_contributed: number
}

function dealMrr(deal: { amount: number; duration_months: number | null; status: string }): number {
  if (!deal.duration_months || deal.duration_months <= 0) return 0
  if (deal.status !== 'active') return 0
  return deal.amount / deal.duration_months
}

export async function GET(_request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Workspace members
    const { data: membersData } = await supabase
      .from('workspace_members')
      .select('user_id, role, status, user:users(full_name, email)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    type RawMember = {
      user_id: string
      role: string
      user: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null
    }
    const members = (membersData ?? []) as unknown as RawMember[]

    function pickUser(u: RawMember['user']): { full_name: string | null; email: string } | null {
      if (!u) return null
      if (Array.isArray(u)) return u[0] ?? null
      return u
    }

    const { data: dealsData, error } = await supabase
      .from('deals')
      .select('closer_id, setter_id, amount, cash_collected, duration_months, status')
      .eq('workspace_id', workspaceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const deals = dealsData ?? []

    const byMember = new Map<string, MemberPerformance>()
    for (const m of members) {
      const u = pickUser(m.user)
      byMember.set(m.user_id, {
        user_id: m.user_id,
        full_name: u?.full_name ?? u?.email ?? m.user_id,
        email: u?.email ?? '',
        role: (m.role as 'admin' | 'setter' | 'closer'),
        deals_as_closer: 0,
        deals_as_setter: 0,
        revenue_closed: 0,
        cash_collected: 0,
        mrr_contributed: 0,
      })
    }

    for (const d of deals) {
      if (d.closer_id) {
        let row = byMember.get(d.closer_id)
        if (!row) {
          row = { user_id: d.closer_id, full_name: 'Inconnu', email: '', role: 'closer', deals_as_closer: 0, deals_as_setter: 0, revenue_closed: 0, cash_collected: 0, mrr_contributed: 0 }
          byMember.set(d.closer_id, row)
        }
        row.deals_as_closer += 1
        row.revenue_closed += Number(d.amount ?? 0)
        row.cash_collected += Number(d.cash_collected ?? 0)
        row.mrr_contributed += dealMrr(d)
      }
      if (d.setter_id && d.setter_id !== d.closer_id) {
        let row = byMember.get(d.setter_id)
        if (!row) {
          row = { user_id: d.setter_id, full_name: 'Inconnu', email: '', role: 'setter', deals_as_closer: 0, deals_as_setter: 0, revenue_closed: 0, cash_collected: 0, mrr_contributed: 0 }
          byMember.set(d.setter_id, row)
        }
        row.deals_as_setter += 1
      }
    }

    const rows = Array.from(byMember.values())
      .map(r => ({
        ...r,
        revenue_closed: Math.round(r.revenue_closed * 100) / 100,
        cash_collected: Math.round(r.cash_collected * 100) / 100,
        mrr_contributed: Math.round(r.mrr_contributed * 100) / 100,
      }))
      .sort((a, b) => b.revenue_closed - a.revenue_closed)

    return NextResponse.json({ data: rows })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('finance team', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
