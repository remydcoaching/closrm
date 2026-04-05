import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { fetchIgMedia, fetchMediaComments } from '@/lib/instagram/api'

// POST — sync comments from Meta for recent media
export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Get connected account
    const { data: account } = await supabase
      .from('ig_accounts')
      .select('ig_user_id, access_token, page_access_token')
      .eq('workspace_id', workspaceId)
      .eq('is_connected', true)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Compte Instagram non connecté' }, { status: 400 })
    }

    const token = account.page_access_token || account.access_token

    // Fetch recent media (last 25 posts)
    const media = await fetchIgMedia(token, 25, account.ig_user_id)

    let totalSynced = 0

    for (const post of media) {
      // Fetch comments for this media
      const comments = await fetchMediaComments(token, post.id)

      if (comments.length === 0) continue

      // Prepare rows for upsert
      const rows = comments.map(c => ({
        workspace_id: workspaceId,
        ig_comment_id: c.id,
        ig_media_id: post.id,
        media_caption: post.caption?.slice(0, 500) ?? null,
        text: c.text,
        username: c.username,
        timestamp: c.timestamp,
        ig_parent_id: c.parent_id ?? null,
      }))

      const { error } = await supabase
        .from('ig_comments')
        .upsert(rows, { onConflict: 'ig_comment_id', ignoreDuplicates: false })

      if (error) {
        console.error(`Sync comments error for media ${post.id}:`, error)
      } else {
        totalSynced += rows.length
      }
    }

    // Link parent_id (UUID) for replies that have an ig_parent_id matching another comment
    try {
      const { error: rpcErr } = await supabase.rpc('link_ig_comment_parents', { ws_id: workspaceId })
      if (rpcErr) {
        console.log('link_ig_comment_parents RPC not available, skipping parent linking:', rpcErr.message)
      }
    } catch {
      console.log('link_ig_comment_parents RPC not available, skipping parent linking')
    }

    return NextResponse.json({ data: { synced: totalSynced, media_count: media.length } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    console.error('Comment sync error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
