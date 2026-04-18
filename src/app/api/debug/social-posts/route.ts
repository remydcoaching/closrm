import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('id, title, caption, media_type, status, scheduled_at, published_at, created_at, publications:social_post_publications(id, platform, status, scheduled_at, published_at, provider_post_id, public_url, error_message, last_attempt_at)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const nowIso = new Date().toISOString()
    return NextResponse.json({
      now: nowIso,
      workspace_id: workspaceId,
      count: posts?.length ?? 0,
      posts,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
