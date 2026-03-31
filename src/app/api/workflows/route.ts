import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createWorkflowSchema, workflowFiltersSchema } from '@/lib/validations/workflows'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const params = Object.fromEntries(request.nextUrl.searchParams)
    const filters = workflowFiltersSchema.parse(params)

    let query = supabase
      .from('workflows')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.trigger_type) query = query.eq('trigger_type', filters.trigger_type)

    if (filters.search) {
      const s = filters.search.trim()
      if (s) {
        query = query.ilike('name', `%${s}%`)
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
    const parsed = createWorkflowSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        trigger_type: parsed.data.trigger_type,
        trigger_config: parsed.data.trigger_config || {},
        status: 'brouillon',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
