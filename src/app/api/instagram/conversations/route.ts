import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igConversationsFiltersSchema } from '@/lib/validations/instagram'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igConversationsFiltersSchema.parse(params)

    let query = supabase
      .from('ig_conversations')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false })

    if (filters.search) {
      query = query.or(
        `participant_username.ilike.%${filters.search}%,participant_name.ilike.%${filters.search}%`
      )
    }

    const from = (filters.page - 1) * filters.per_page
    const to = from + filters.per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total = count ?? 0
    return NextResponse.json({
      data: data ?? [],
      meta: { total, page: filters.page, per_page: filters.per_page },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
