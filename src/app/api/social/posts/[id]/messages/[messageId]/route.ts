import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { z } from 'zod'

const patchSchema = z.object({
  resolved: z.boolean(),
})

// PATCH /api/social/posts/[id]/messages/[messageId]
// Toggle resolved status d'une annotation video.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const { id: slotId, messageId } = await params
    const { workspaceId, userId } = await getWorkspaceId()
    const json = await request.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const update = parsed.data.resolved
      ? { resolved_at: new Date().toISOString(), resolved_by: userId }
      : { resolved_at: null, resolved_by: null }

    const { data, error } = await supabase
      .from('social_post_messages')
      .update(update)
      .eq('id', messageId)
      .eq('social_post_id', slotId)
      .eq('workspace_id', workspaceId)
      .select('id, author_id, body, created_at, video_timestamp_seconds, resolved_at, resolved_by')
      .single()
    if (error) throw error

    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
