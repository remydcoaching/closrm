import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createLeadSchema, leadFiltersSchema } from '@/lib/validations/leads'
import { fireTriggersForEvent } from '@/lib/workflows/trigger'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = leadFiltersSchema.parse(searchParams)

    let query = supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, status, source, tags, reached, call_attempts, notes, created_at, updated_at', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(filters.sort, { ascending: filters.order === 'asc' })

    // Filtre par statut (liste séparée par virgule)
    if (filters.status) {
      const statuses = filters.status.split(',')
      query = query.in('status', statuses)
    }

    // Filtre par source (liste séparée par virgule)
    if (filters.source) {
      const sources = filters.source.split(',')
      query = query.in('source', sources)
    }

    // Recherche texte (prénom, nom, email, téléphone)
    if (filters.search) {
      const s = filters.search.trim()
      if (s) {
        // Escape special PostgREST characters in search term
        const escaped = s.replace(/[%_]/g, '\\$&')
        query = query.or(
          `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
        )
      }
    }

    // Filtre par tags (au moins un des tags listés)
    if (filters.tags) {
      const tags = filters.tags.split(',').filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }

    // Pagination
    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[API /leads] Supabase error:', error.message, '| filters:', JSON.stringify(filters))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const total = count ?? 0
    const total_pages = Math.ceil(total / filters.per_page)

    return NextResponse.json({
      data: data ?? [],
      meta: {
        total,
        page: filters.page,
        per_page: filters.per_page,
        total_pages,
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
    const parsed = createLeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        status: 'nouveau',
        call_attempts: 0,
        reached: false,
        ...parsed.data,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fire workflow triggers (non-blocking)
    fireTriggersForEvent(workspaceId, 'new_lead', {
      lead_id: data.id,
      source: data.source,
    }).catch(() => {})

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
