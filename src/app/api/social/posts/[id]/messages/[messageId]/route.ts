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

    // RLS gere l'autorisation. On filtre sur (id, slot, workspace) pour la
    // safety mais on utilise maybeSingle() pour distinguer 'pas trouve' de
    // 'erreur DB' — sinon .single() throw "Cannot coerce" sur 0 row, ce qui
    // masque la vraie raison (RLS denied / id incorrect).
    const { data, error } = await supabase
      .from('social_post_messages')
      .update(update)
      .eq('id', messageId)
      .eq('social_post_id', slotId)
      .eq('workspace_id', workspaceId)
      .select('id, author_id, body, created_at, video_timestamp_seconds, resolved_at, resolved_by')
      .maybeSingle()
    if (error) {
      console.error('[messages PATCH] supabase error:', error)
      return NextResponse.json({ error: error.message ?? 'Erreur DB' }, { status: 500 })
    }
    if (!data) {
      console.error('[messages PATCH] no row updated', { messageId, slotId, workspaceId })
      return NextResponse.json(
        { error: 'Annotation introuvable ou non modifiable (RLS)' },
        { status: 404 },
      )
    }

    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof Error && e.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('[messages PATCH] failed:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
