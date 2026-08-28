import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateDmSessionItemSchema } from '@/lib/validations/dm-sessions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
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
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Profil introuvable dans la session' }, { status: 404 })
    }

    if (parsed.data.outcome === 'archived') {
      await supabase.from('leads').update({ status: 'dead' }).eq('id', item.lead_id)
    }

    if (parsed.data.outcome === 'relaunched' && parsed.data.delay_days) {
      const scheduledAt = new Date(Date.now() + parsed.data.delay_days * 86_400_000).toISOString()
      await supabase.from('follow_ups').insert({
        workspace_id: workspaceId,
        lead_id: item.lead_id,
        reason: 'Relance session DM',
        scheduled_at: scheduledAt,
        channel: 'instagram_dm',
        status: 'en_attente',
      })
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
