import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { replyToComment } from '@/lib/instagram/api'

// GET — list comments from DB, optional ?media_id= filter
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const mediaId = request.nextUrl.searchParams.get('media_id')

    let query = supabase
      .from('ig_comments')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('timestamp', { ascending: false })

    if (mediaId) {
      query = query.eq('ig_media_id', mediaId)
    }

    const { data, error, count } = await query.limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [], meta: { total: count ?? 0 } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — reply to a comment via Meta API, save reply to DB
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const { comment_id, ig_comment_id, ig_media_id, message } = body

    if (!ig_comment_id || !message) {
      return NextResponse.json({ error: 'ig_comment_id et message requis' }, { status: 400 })
    }

    // Get account token
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('access_token, page_access_token')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Compte Instagram non connecté' }, { status: 400 })
    }

    const token = account.page_access_token || account.access_token

    // Reply via Meta API
    const replyIgId = await replyToComment(token, ig_comment_id, message)

    // Save reply to DB
    const { data: reply, error: insertErr } = await supabase
      .from('ig_comments')
      .insert({
        workspace_id: workspaceId,
        ig_comment_id: replyIgId,
        ig_media_id: ig_media_id || '',
        text: message,
        username: null, // own reply
        timestamp: new Date().toISOString(),
        parent_id: comment_id || null,
        ig_parent_id: ig_comment_id,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Failed to save reply to DB:', insertErr)
      // Still return success since the reply was posted to Meta
      return NextResponse.json({ data: { ig_comment_id: replyIgId } })
    }

    return NextResponse.json({ data: reply })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
