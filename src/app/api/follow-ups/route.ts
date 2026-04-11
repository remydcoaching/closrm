import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createFollowUpSchema, followUpFiltersSchema } from '@/lib/validations/follow-ups'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const filters = followUpFiltersSchema.parse(params)

    let query = supabase
      .from('follow_ups')
      .select('*, lead:leads!inner(id, first_name, last_name, phone, email, status, assigned_to)', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim())
      query = query.in('status', statuses)
    }
    if (filters.channel) {
      const channels = filters.channel.split(',').map((s) => s.trim())
      query = query.in('channel', channels)
    }
    if (filters.lead_id) query = query.eq('lead_id', filters.lead_id)
    if (filters.scheduled_after) query = query.gte('scheduled_at', filters.scheduled_after)
    if (filters.scheduled_before) query = query.lt('scheduled_at', filters.scheduled_before)

    if (filters.search) {
      const s = filters.search.trim()
      if (s) {
        const { data: matchingLeads } = await supabase
          .from('leads').select('id').eq('workspace_id', workspaceId)
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
    query = query.range(from, from + filters.per_page - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data: data ?? [],
      meta: { total: count ?? 0, page: filters.page, per_page: filters.per_page, total_pages: Math.ceil((count ?? 0) / filters.per_page) },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createFollowUpSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await supabase
      .from('follow_ups')
      .insert({ workspace_id: workspaceId, ...parsed.data, status: 'en_attente', notes: parsed.data.notes || null })
      .select('*, lead:leads(id, first_name, last_name, phone, email, status, assigned_to)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update last_activity_at on the lead (non-blocking)
    supabase
      .from('leads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)
      .then(() => {})

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
