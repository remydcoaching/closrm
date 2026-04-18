import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createServiceClient } from '@/lib/supabase/service'
import { publishPostNow } from '@/lib/social/publish'

export const maxDuration = 300

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { workspaceId } = await getWorkspaceId()

    // Verify post belongs to workspace (via RLS-aware client)
    const authed = await createClient()
    const { data: post, error } = await authed
      .from('social_posts')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!post || post.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    }

    const service = createServiceClient()
    const result = await publishPostNow(service, id)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
