import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { resolveSessionStep, loadActiveProcessSteps } from '@/lib/dm-sessions/resolve-step'
import { updateDmSessionSchema } from '@/lib/validations/dm-sessions'
import type { PriorityCategory } from '@/lib/dm-sessions/priority'

interface SessionItemLead {
  first_name: string
  last_activity_at: string | null
}

interface SessionItemRow {
  category: PriorityCategory
  outcome: string | null
  lead: SessionItemLead
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // session et activeProcessSteps sont indépendants (l'un dépend de id +
    // workspaceId, l'autre juste de workspaceId) — parallélisés plutôt
    // qu'attendus séquentiellement.
    const [{ data: session, error }, activeProcessSteps] = await Promise.all([
      supabase
        .from('dm_sessions')
        .select('*, items:dm_session_items(*, lead:leads(id, first_name, last_name, instagram_handle, instagram_user_id, status, last_activity_at))')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single(),
      // Le template affiché vient du process de setting actif si un existe,
      // sinon de pickTemplate() (fallback pendant la migration). Résolu par
      // item non traité uniquement — inutile de calculer pour un item déjà
      // clos. Process + steps + transitions préchargés une seule fois
      // (identiques pour tous les items de la session) plutôt que refetch à
      // chaque item — c'était la cause principale de la lenteur au
      // chargement d'une session avec 30-45 items.
      loadActiveProcessSteps(supabase, workspaceId),
    ])

    if (error || !session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }
    const items = await Promise.all(
      (session.items as SessionItemRow[]).map(async (item) => {
        if (item.outcome !== null) return item

        const daysSinceLastContact = item.lead.last_activity_at
          ? Math.floor((Date.now() - new Date(item.lead.last_activity_at).getTime()) / 86_400_000)
          : null

        const template = await resolveSessionStep(
          supabase,
          workspaceId,
          item.category,
          { firstName: item.lead.first_name, daysSinceLastContact },
          activeProcessSteps
        )

        return { ...item, template }
      })
    )

    return NextResponse.json({ data: { ...session, items } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateDmSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('dm_sessions')
      .update({ status: parsed.data.status })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .select()
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session introuvable ou déjà terminée' }, { status: 404 })
    }

    return NextResponse.json({ data: session })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
