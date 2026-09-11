import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { hasPermission } from '@/lib/permissions'
import { createSettingProcessStepTransitionSchema } from '@/lib/validations/setting-processes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: processId, stepId } = await params
    const { workspaceId, role } = await getWorkspaceId()
    if (!hasPermission(role, 'manageProcesses')) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs' }, { status: 403 })
    }
    const supabase = await createClient()

    const { data: step } = await supabase
      .from('setting_process_steps')
      .select('id, setting_processes!inner(workspace_id)')
      .eq('id', stepId)
      .eq('process_id', processId)
      .eq('setting_processes.workspace_id', workspaceId)
      .single()

    if (!step) {
      return NextResponse.json({ error: 'Étape introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = createSettingProcessStepTransitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // La cible doit appartenir au même process — sinon la transition
    // pointerait vers l'étape d'un autre process, incohérent.
    const { data: targetStep } = await supabase
      .from('setting_process_steps')
      .select('id')
      .eq('id', parsed.data.target_step_id)
      .eq('process_id', processId)
      .single()

    if (!targetStep) {
      return NextResponse.json({ error: "L'étape cible doit appartenir au même process" }, { status: 400 })
    }

    const { data: transition, error } = await supabase
      .from('setting_process_step_transitions')
      .insert({ step_id: stepId, ...parsed.data })
      .select()
      .single()

    if (error || !transition) {
      return NextResponse.json({ error: 'Impossible de créer la transition' }, { status: 500 })
    }

    return NextResponse.json({ data: transition })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
