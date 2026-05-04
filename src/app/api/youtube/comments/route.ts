import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

// GET — list yt_comments enriched with parent video title for context
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const limit = Math.min(200, parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10))

    const { data, error } = await supabase
      .from('yt_comments')
      .select(`
        id, yt_comment_id, yt_video_id, parent_id,
        author_name, author_channel_id, author_avatar_url,
        text, like_count, is_hidden, published_at,
        yt_videos:yt_video_id ( title, yt_video_id )
      `)
      .eq('workspace_id', workspaceId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated')
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
