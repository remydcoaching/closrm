import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createDraftSchema, igDraftsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igDraftsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_drafts')
      .select('id, caption, hashtags, media_urls, media_type, status, scheduled_at, created_at, updated_at', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (filters.status) query = query.eq('status', filters.status)

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

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createDraftSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    if (parsed.data.status === 'scheduled' && !parsed.data.scheduled_at) {
      return NextResponse.json({ error: 'Date de programmation requise' }, { status: 400 })
    }
    if (parsed.data.status === 'scheduled' && parsed.data.scheduled_at && new Date(parsed.data.scheduled_at) <= new Date()) {
      return NextResponse.json({ error: 'La date de programmation doit être dans le futur' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ig_drafts')
      .insert({
        workspace_id: workspaceId,
        ...parsed.data,
        scheduled_at: parsed.data.scheduled_at ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
