import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { hasPermission } from '@/lib/permissions'
import { createSettingProcessStepSchema } from '@/lib/validations/setting-processes'

export async function POST(
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

    // Confirme que le process appartient au workspace avant d'y ajouter une étape.
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
    const parsed = createSettingProcessStepSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { count } = await supabase
      .from('setting_process_steps')
      .select('*', { count: 'exact', head: true })
      .eq('process_id', processId)

    const { data: step, error } = await supabase
      .from('setting_process_steps')
      .insert({ process_id: processId, position: count ?? 0, ...parsed.data })
      .select()
      .single()

    if (error || !step) {
      return NextResponse.json({ error: "Impossible de créer l'étape" }, { status: 500 })
    }

    // Chaîne automatiquement la nouvelle étape après la précédente dans
    // l'ordre par défaut, sauf si c'est la première étape du process.
    if ((count ?? 0) > 0) {
      const { data: previousStep } = await supabase
        .from('setting_process_steps')
        .select('id')
        .eq('process_id', processId)
        .eq('position', (count ?? 0) - 1)
        .single()

      if (previousStep) {
        await supabase
          .from('setting_process_steps')
          .update({ next_step_id: step.id })
          .eq('id', previousStep.id)
      }
    }

    return NextResponse.json({ data: step })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
