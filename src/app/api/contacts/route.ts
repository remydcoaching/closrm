import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { contactFiltersSchema } from '@/lib/validations/contacts'
import { ContactRow } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = contactFiltersSchema.parse(searchParams)

    // SELECT leads + calls agrégés via relation Supabase
    let query = supabase
      .from('leads')
      .select('*, calls(id, scheduled_at)', { count: 'exact' })
      .eq('workspace_id', workspaceId)

    // Filtre statut
    if (filters.status) {
      const statuses = filters.status.split(',').filter(Boolean)
      query = query.in('status', statuses)
    }

    // Filtre source
    if (filters.source) {
      const sources = filters.source.split(',').filter(Boolean)
      query = query.in('source', sources)
    }

    // Filtre tags (au moins un tag parmi la liste)
    if (filters.tags) {
      const tags = filters.tags.split(',').filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }

    // Recherche full-text (ILIKE sur prénom, nom, email, téléphone)
    if (filters.search) {
      const s = filters.search.trim()
      query = query.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
      )
    }

    // Filtre date de création
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from)
    }
    if (filters.date_to) {
      query = query.lte('created_at', `${filters.date_to}T23:59:59Z`)
    }

    // Filtre joint/non-joint
    if (filters.reached === 'true') {
      query = query.eq('reached', true)
    } else if (filters.reached === 'false') {
      query = query.eq('reached', false)
    }

    // Tri : par défaut created_at desc, group_by change le tri primaire
    if (filters.group_by === 'status') {
      query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
    } else if (filters.group_by === 'source') {
      query = query.order('source', { ascending: true }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transformer : agréger les calls en nb_calls + last_call_at
    const contacts: ContactRow[] = (data ?? []).map((lead) => {
      const calls = (lead.calls as { id: string; scheduled_at: string }[]) ?? []
      const last_call_at = calls.length > 0
        ? calls.reduce((max, c) => c.scheduled_at > max ? c.scheduled_at : max, calls[0].scheduled_at)
        : null

      return {
        id: lead.id,
        workspace_id: lead.workspace_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        source: lead.source,
        tags: lead.tags,
        reached: lead.reached,
        notes: lead.notes,
        meta_campaign_id: lead.meta_campaign_id,
        meta_adset_id: lead.meta_adset_id,
        meta_ad_id: lead.meta_ad_id,
        call_attempts: lead.call_attempts,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        nb_calls: calls.length,
        last_call_at,
      }
    })

    const total = count ?? 0
    const total_pages = Math.ceil(total / filters.per_page)

    return NextResponse.json({
      data: contacts,
      meta: { total, page: filters.page, per_page: filters.per_page, total_pages },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
