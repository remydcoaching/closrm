import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

interface MemberStats {
  messages_sent: number
  calls_total: number
  calls_reached: number
  rdv_booked: number
  closings: number
  deal_amount: number
  no_shows: number
  joignabilite: number
  closing_rate: number
}

interface MemberReport {
  user_id: string
  full_name: string
  email: string
  role: string
  stats: MemberStats
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId, role } = await getWorkspaceId()

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Acces reserve aux administrateurs' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from et date_to sont requis (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const dateFromISO = `${dateFrom}T00:00:00.000Z`
    const dateToISO = `${dateTo}T23:59:59.999Z`

    // Use service client to bypass RLS on workspace_members
    const serviceClient = createServiceClient()

    // Fetch active members with user info
    const { data: members, error: membersError } = await serviceClient
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (membersError) {
      console.error('[API /workspaces/reporting] members error:', membersError.message)
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    if (!members || members.length === 0) {
      return NextResponse.json({
        data: {
          members: [],
          period: { from: dateFrom, to: dateTo },
        },
      })
    }

    const userIds = members.map(m => m.user_id)

    // Fetch user profiles
    const { data: users } = await serviceClient
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds)

    const userMap = new Map((users || []).map(u => [u.id, u]))

    // Fetch all calls for this workspace in the period
    const { data: calls } = await serviceClient
      .from('calls')
      .select('assigned_to, type, outcome, reached')
      .eq('workspace_id', workspaceId)
      .gte('created_at', dateFromISO)
      .lte('created_at', dateToISO)

    // Fetch closed leads for this workspace in the period
    const { data: allClosedLeads } = await serviceClient
      .from('leads')
      .select('assigned_to, deal_amount, closed_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'clos')

    // Filter closed leads by period (closed_at ?? updated_at)
    const closedLeads = (allClosedLeads ?? []).filter(lead => {
      const effectiveDate = lead.closed_at ?? lead.updated_at
      if (!effectiveDate) return false
      return effectiveDate >= dateFromISO && effectiveDate <= dateToISO
    })

    // Build stats per member
    const result: MemberReport[] = members.map(member => {
      const userId = member.user_id
      const user = userMap.get(userId)

      const memberCalls = (calls ?? []).filter(c => c.assigned_to === userId)
      const callsTotal = memberCalls.length
      const callsReached = memberCalls.filter(c => c.reached === true).length
      const rdvBooked = memberCalls.filter(c => c.type === 'closing').length
      const noShows = memberCalls.filter(c => c.outcome === 'no_show').length

      const memberClosedLeads = closedLeads.filter(l => l.assigned_to === userId)
      const closings = memberClosedLeads.length
      const dealAmount = memberClosedLeads.reduce(
        (sum, l) => sum + (Number(l.deal_amount) || 0),
        0
      )

      const joignabilite = callsTotal > 0
        ? Math.round((callsReached / callsTotal) * 100)
        : 0

      const closingRate = rdvBooked > 0
        ? Math.round((closings / rdvBooked) * 100)
        : 0

      return {
        user_id: userId,
        full_name: user?.full_name || 'Inconnu',
        email: user?.email || '',
        role: member.role,
        stats: {
          messages_sent: 0,
          calls_total: callsTotal,
          calls_reached: callsReached,
          rdv_booked: rdvBooked,
          closings,
          deal_amount: Math.round(dealAmount * 100) / 100,
          no_shows: noShows,
          joignabilite,
          closing_rate: closingRate,
        },
      }
    })

    return NextResponse.json({
      data: {
        members: result,
        period: { from: dateFrom, to: dateTo },
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /workspaces/reporting] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
