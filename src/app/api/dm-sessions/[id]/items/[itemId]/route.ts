import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateDmSessionItemSchema } from '@/lib/validations/dm-sessions'
import { markConversationActive } from '@/lib/dm-sessions/mark-conversation-active'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateDmSessionItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: item } = await supabase
      .from('dm_session_items')
      .select('lead_id')
      .eq('id', itemId)
      .eq('session_id', id)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Profil introuvable dans la session' }, { status: 404 })
    }

    if (parsed.data.outcome === 'archived') {
      const { error: leadError } = await supabase.from('leads').update({ status: 'dead' }).eq('id', item.lead_id)
      if (leadError) {
        return NextResponse.json({ error: 'Impossible d\'archiver le lead' }, { status: 500 })
      }
    }

    if (parsed.data.outcome === 'replied') {
      const { error: replyError } = await markConversationActive(supabase, workspaceId, item.lead_id)
      if (replyError) {
        return NextResponse.json({ error: replyError }, { status: 500 })
      }
    }

    if (parsed.data.outcome === 'relaunched' && parsed.data.delay_days) {
      const scheduledAt = new Date(Date.now() + parsed.data.delay_days * 86_400_000).toISOString()
      const { error: followUpError } = await supabase.from('follow_ups').insert({
        workspace_id: workspaceId,
        lead_id: item.lead_id,
        reason: 'Relance session DM',
        scheduled_at: scheduledAt,
        channel: 'instagram_dm',
        status: 'en_attente',
        notes: parsed.data.note ?? '',
      })
      if (followUpError) {
        return NextResponse.json({ error: 'Impossible de créer la relance' }, { status: 500 })
      }
    }

    const { data: updated, error } = await supabase
      .from('dm_session_items')
      .update({ outcome: parsed.data.outcome, note: parsed.data.note ?? null, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: 'Impossible de mettre à jour le profil' }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
