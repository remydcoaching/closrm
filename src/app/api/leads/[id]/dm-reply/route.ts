import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * "PROSPECT A RÉPONDU" — ClosRM ne lit pas Instagram automatiquement, donc
 * cette action est déclarée manuellement par le setter (fiche lead PC ou
 * mobile), indépendamment de toute session DM en cours. Elle marque la
 * conversation comme active (dm_conversation_active_at) et annule les
 * relances en attente pour ce lead : la relance programmée n'a plus de sens
 * si la conversation continue déjà.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    const { error: leadError } = await supabase
      .from('leads')
      .update({ dm_conversation_active_at: new Date().toISOString() })
      .eq('id', leadId)

    if (leadError) {
      return NextResponse.json({ error: 'Impossible de mettre à jour le lead' }, { status: 500 })
    }

    const { error: followUpError } = await supabase
      .from('follow_ups')
      .update({ status: 'annule' })
      .eq('lead_id', leadId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'en_attente')

    if (followUpError) {
      return NextResponse.json({ error: "Impossible d'annuler les relances en attente" }, { status: 500 })
    }

    return NextResponse.json({ data: { lead_id: leadId, dm_conversation_active_at: new Date().toISOString() } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
