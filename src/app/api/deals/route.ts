import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const sp = request.nextUrl.searchParams
    const leadId = sp.get('lead_id') || undefined
    const closerId = sp.get('closer_id') || undefined
    const setterId = sp.get('setter_id') || undefined
    const status = sp.get('status') || undefined
    const dateFrom = sp.get('date_from') || undefined
    const dateTo = sp.get('date_to') || undefined

    const supabase = await createClient()
    let query = supabase
      .from('deals')
      .select('*, lead:leads(id, first_name, last_name, email, phone)')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })

    if (leadId) query = query.eq('lead_id', leadId)
    if (closerId) query = query.eq('closer_id', closerId)
    if (setterId) query = query.eq('setter_id', setterId)
    if (status) query = query.in('status', status.split(','))
    if (dateFrom) query = query.gte('started_at', dateFrom)
    if (dateTo) query = query.lte('started_at', dateTo)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()
    const lead_id = body?.lead_id as string | undefined
    const amount = Number(body?.amount)
    const cash_collected = body?.cash_collected != null ? Number(body.cash_collected) : 0
    const installments = body?.installments != null ? parseInt(String(body.installments), 10) : 1
    const duration_months = body?.duration_months != null && body.duration_months !== ''
      ? parseInt(String(body.duration_months), 10)
      : null
    const started_at = body?.started_at || new Date().toISOString()
    const setter_id = body?.setter_id || null
    const closer_id = body?.closer_id || null
    const notes = body?.notes || null

    if (!lead_id || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'lead_id + amount required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('deals')
      .insert({
        workspace_id: workspaceId,
        lead_id,
        amount,
        cash_collected,
        installments,
        duration_months,
        started_at,
        setter_id,
        closer_id,
        notes,
        status: 'active',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Keep lead in 'clos' status for compat (badge, filters, etc.)
    await supabase
      .from('leads')
      .update({
        status: 'clos',
        closed_at: started_at,
        deal_amount: amount,
        cash_collected,
        deal_installments: installments,
      })
      .eq('id', lead_id)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
