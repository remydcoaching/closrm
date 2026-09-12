import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { hasPermission } from '@/lib/permissions'
import { reorderSettingProcessStepsSchema } from '@/lib/validations/setting-processes'

/**
 * Réordonne les étapes d'un process après un drag & drop. Ne touche qu'à la
 * colonne `position` — les step id restent stables, donc next_step_id et
 * les transitions nommées (qui référencent des id, pas des positions)
 * restent valides après réordonnancement.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: processId } = await params
    const { workspaceId, role } = await getWorkspaceId()
    if (!hasPermission(role, 'manageProcesses')) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs' }, { status: 403 })
    }
    const supabase = await createClient()

    const { data: process } = await supabase
      .from('setting_processes')
      .select('id')
      .eq('id', processId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!process) {
      return NextResponse.json({ error: 'Process introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = reorderSettingProcessStepsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Confirme que chaque step id appartient bien à ce process avant
    // d'écrire — évite qu'une requête forgée touche les étapes d'un autre
    // process via un id volé.
    const { data: existingSteps } = await supabase
      .from('setting_process_steps')
      .select('id')
      .eq('process_id', processId)
    const validIds = new Set((existingSteps ?? []).map((s) => s.id))
    const hasInvalidId = parsed.data.some((item) => !validIds.has(item.id))
    if (hasInvalidId) {
      return NextResponse.json({ error: "Une étape ne correspond pas à ce process" }, { status: 400 })
    }

    const updates = parsed.data.map((item) =>
      supabase
        .from('setting_process_steps')
        .update({ position: item.position, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('process_id', processId)
    )

    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      return NextResponse.json({ error: "Impossible de réordonner les étapes" }, { status: 500 })
    }

    const { data: steps } = await supabase
      .from('setting_process_steps')
      .select('*, transitions:setting_process_step_transitions(*)')
      .eq('process_id', processId)
      .order('position', { ascending: true })

    return NextResponse.json({ data: steps ?? [] })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
