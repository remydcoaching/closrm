import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { listInteractionsSchema } from '@/lib/validations/instagram-interactions'

/**
 * Workspace-wide Instagram interactions listing (Instagram > Interactions).
 * Reads the SAME instagram_interactions table both Hiker (src/lib/hiker/persist.ts)
 * and Apify (src/lib/apify/process-likers.ts) already write into — no new
 * table, no duplicated data. Filters mirror what those two providers already
 * populate (interaction_type, source_provider, source_post_id).
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const parsed = listInteractionsSchema.safeParse(searchParams)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const filters = parsed.data

    let query = supabase
      .from('instagram_interactions')
      .select(
        'id, workspace_id, lead_id, interaction_type, instagram_user_id, instagram_username, full_name, profile_url, source_post_id, source_post_url, source_provider, first_seen_at, last_seen_at, metadata, leads(id, first_name, last_name, instagram_handle, status)',
        { count: 'planned' },
      )
      .eq('workspace_id', workspaceId)
      .order('last_seen_at', { ascending: false })

    if (filters.interaction_type) query = query.eq('interaction_type', filters.interaction_type)
    if (filters.source_provider) query = query.eq('source_provider', filters.source_provider)
    if (filters.lead_id) query = query.eq('lead_id', filters.lead_id)
    if (filters.source_post_id) query = query.eq('source_post_id', filters.source_post_id)
    if (filters.date_from) query = query.gte('last_seen_at', filters.date_from)
    if (filters.date_to) query = query.lte('last_seen_at', filters.date_to)

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lead = row.leads as any
      const { leads: _leads, ...rest } = row as Record<string, unknown>
      return { ...rest, lead: lead ?? null }
    })

    return NextResponse.json({
      data: rows,
      meta: {
        total: count ?? 0,
        page: filters.page,
        per_page: filters.per_page,
        total_pages: count ? Math.ceil(count / filters.per_page) : 1,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
