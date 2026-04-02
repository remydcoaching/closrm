import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igReelsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igReelsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_reels')
      .select('*, pillar:ig_content_pillars(id, name, color)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(filters.sort, { ascending: filters.order === 'asc' })

    if (filters.pillar_id) query = query.eq('pillar_id', filters.pillar_id)
    if (filters.format) query = query.eq('format', filters.format)

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      meta: { total, page: filters.page, per_page: filters.per_page, total_pages: Math.ceil(total / filters.per_page) },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const { reel_id, pillar_id, format } = body

    if (!reel_id) return NextResponse.json({ error: 'reel_id requis' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (pillar_id !== undefined) updates.pillar_id = pillar_id || null
    if (format !== undefined) updates.format = format || null

    const { data, error } = await supabase
      .from('ig_reels')
      .update(updates)
      .eq('id', reel_id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
