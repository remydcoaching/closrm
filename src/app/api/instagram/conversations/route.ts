import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { igConversationsFiltersSchema } from '@/lib/validations/instagram'
import { syncConversations } from '@/lib/instagram/sync'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const params = Object.fromEntries(request.nextUrl.searchParams.entries())
    const filters = igConversationsFiltersSchema.parse(params)
    const shouldSync = request.nextUrl.searchParams.get('sync') === 'true'
    let syncWarning: string | null = null

    // Sync from Meta API if requested
    if (shouldSync) {
      try {
        const { data: account } = await supabase
          .from('ig_accounts')
          .select('access_token, ig_user_id, page_id, page_access_token')
          .eq('workspace_id', workspaceId)
          .eq('is_connected', true)
          .maybeSingle()

        if (account?.page_id && account?.page_access_token) {
          await syncConversations({
            supabase,
            workspaceId,
            accessToken: account.access_token,
            igUserId: account.ig_user_id,
            pageId: account.page_id,
            pageAccessToken: account.page_access_token,
          })
        }
      } catch (syncErr) {
        const msg = syncErr instanceof Error ? syncErr.message : 'Sync failed'
        console.error('[API /instagram/conversations] Sync failed:', msg)
        syncWarning = msg
      }
    }

    let query = supabase
      .from('ig_conversations')
      .select('id, participant_username, participant_name, participant_ig_id, participant_avatar_url, lead_id, last_message_at, last_message_text, unread_count', { count: 'exact' })
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
      ...(syncWarning ? { syncWarning } : {}),
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
