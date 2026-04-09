import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface CrmFunnelData {
  calls_total: number
  calls_reached: number
  bookings_total: number
  bookings_show_up: number
  closings: number
  deal_amount_total: number
  cash_collected_total: number
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from and date_to are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Build ISO timestamps for range filtering
    const dateFromISO = `${dateFrom}T00:00:00.000Z`
    const dateToISO = `${dateTo}T23:59:59.999Z`

    // Run all queries in parallel
    const [
      callsTotalRes,
      callsReachedRes,
      bookingsTotalRes,
      bookingsShowUpRes,
      closedLeadsRes,
    ] = await Promise.all([
      // 1. calls total
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', dateFromISO)
        .lte('created_at', dateToISO),

      // 2. calls reached
      supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('reached', true)
        .gte('created_at', dateFromISO)
        .lte('created_at', dateToISO),

      // 3. bookings total
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('scheduled_at', dateFromISO)
        .lte('scheduled_at', dateToISO),

      // 4. bookings show up (completed or confirmed)
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .in('status', ['completed', 'confirmed'])
        .gte('scheduled_at', dateFromISO)
        .lte('scheduled_at', dateToISO),

      // 5. closed leads — fetch rows to count + sum amounts
      // Use closed_at when available, fall back to updated_at
      supabase
        .from('leads')
        .select('deal_amount, cash_collected, closed_at, updated_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'clos'),
    ])

    // Filter closed leads by period client-side (closed_at ?? updated_at)
    const closedLeads = (closedLeadsRes.data ?? []).filter(lead => {
      const effectiveDate = lead.closed_at ?? lead.updated_at
      if (!effectiveDate) return false
      return effectiveDate >= dateFromISO && effectiveDate <= dateToISO
    })

    const closings = closedLeads.length
    const dealAmountTotal = closedLeads.reduce(
      (sum, row) => sum + (Number(row.deal_amount) || 0),
      0
    )
    const cashCollectedTotal = closedLeads.reduce(
      (sum, row) => sum + (Number(row.cash_collected) || 0),
      0
    )

    const data: CrmFunnelData = {
      calls_total: callsTotalRes.count ?? 0,
      calls_reached: callsReachedRes.count ?? 0,
      bookings_total: bookingsTotalRes.count ?? 0,
      bookings_show_up: bookingsShowUpRes.count ?? 0,
      closings,
      deal_amount_total: Math.round(dealAmountTotal * 100) / 100,
      cash_collected_total: Math.round(cashCollectedTotal * 100) / 100,
    }

    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.error('CRM funnel error:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Erreur lors du calcul du funnel CRM' },
      { status: 500 }
    )
  }
}
