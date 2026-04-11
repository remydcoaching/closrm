import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createCallSchema, callFiltersSchema } from '@/lib/validations/calls'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'
import { getNextCloser } from '@/lib/team/round-robin'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const params = Object.fromEntries(request.nextUrl.searchParams)
    const filters = callFiltersSchema.parse(params)

    let query = supabase
      .from('calls')
      .select('*, lead:leads!inner(id, first_name, last_name, phone, email, status)', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (filters.type) query = query.eq('type', filters.type)

    if (filters.outcome) {
      const outcomes = filters.outcome.split(',').map((s) => s.trim())
      query = query.in('outcome', outcomes)
    }

    if (filters.scheduled_after) query = query.gte('scheduled_at', filters.scheduled_after)
    if (filters.scheduled_before) query = query.lt('scheduled_at', filters.scheduled_before)
    if (filters.lead_id) query = query.eq('lead_id', filters.lead_id)

    if (filters.search) {
      const s = filters.search.trim()
      if (s) {
        // Search by lead name — fetch matching lead IDs first
        const { data: matchingLeads } = await supabase
          .from('leads')
          .select('id')
          .eq('workspace_id', workspaceId)
          .or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`)
        if (matchingLeads && matchingLeads.length > 0) {
          query = query.in('lead_id', matchingLeads.map((l) => l.id))
        } else {
          return NextResponse.json({ data: [], meta: { total: 0, page: filters.page, per_page: filters.per_page, total_pages: 0 } })
        }
      }
    }

    query = query.order(filters.sort, { ascending: filters.order === 'asc' })

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data: data ?? [],
      meta: {
        total: count ?? 0,
        page: filters.page,
        per_page: filters.per_page,
        total_pages: Math.ceil((count ?? 0) / filters.per_page),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = createCallSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Auto-increment attempt_number
    const { count } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', parsed.data.lead_id)
      .eq('type', parsed.data.type)

    const { data, error } = await supabase
      .from('calls')
      .insert({
        workspace_id: workspaceId,
        lead_id: parsed.data.lead_id,
        type: parsed.data.type,
        scheduled_at: parsed.data.scheduled_at,
        outcome: 'pending',
        attempt_number: (count ?? 0) + 1,
        reached: false,
        notes: parsed.data.notes || null,
        closer_id: parsed.data.closer_id || null,
      })
      .select('*, lead:leads(id, first_name, last_name, phone, email, status)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-change lead status
    const newStatus = parsed.data.type === 'setting' ? 'setting_planifie' : 'closing_planifie'
    await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)

    // Auto-assign to closest available closer (round-robin) for closing calls
    // Always reassign — the lead was with a setter, now it goes to a closer
    if (parsed.data.type === 'closing') {
      const nextCloser = await getNextCloser(workspaceId)
      if (nextCloser) {
        await supabase
          .from('leads')
          .update({ assigned_to: nextCloser })
          .eq('id', parsed.data.lead_id)
          .eq('workspace_id', workspaceId)

        // Also assign the call itself to the closer
        await supabase
          .from('calls')
          .update({ assigned_to: nextCloser })
          .eq('id', data.id)
          .eq('workspace_id', workspaceId)
      }
    }

    // Update last_activity_at on the lead (non-blocking)
    supabase
      .from('leads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)
      .then(() => {})

    // Fire workflow triggers (non-blocking)
    fireTriggersForEvent(workspaceId, 'call_scheduled', {
      lead_id: parsed.data.lead_id,
      call_id: data.id,
      call_type: parsed.data.type,
    }).catch(() => {})

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
