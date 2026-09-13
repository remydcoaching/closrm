import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { hasPermission } from '@/lib/permissions'
import { updateSettingProcessStepSchema } from '@/lib/validations/setting-processes'

async function assertStepInWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  processId: string,
  stepId: string
) {
  const { data: step } = await supabase
    .from('setting_process_steps')
    .select('id, process_id, setting_processes!inner(workspace_id)')
    .eq('id', stepId)
    .eq('process_id', processId)
    .eq('setting_processes.workspace_id', workspaceId)
    .single()
  return step
}

export async function PATCH(
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

    const step = await assertStepInWorkspace(supabase, workspaceId, processId, stepId)
    if (!step) {
      return NextResponse.json({ error: 'Étape introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSettingProcessStepSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('setting_process_steps')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', stepId)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: "Impossible de mettre à jour l'étape" }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: processId, stepId } = await params
    const { workspaceId, role } = await getWorkspaceId()
    if (!hasPermission(role, 'manageProcesses')) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs' }, { status: 403 })
    }
    const supabase = await createClient()

    const step = await assertStepInWorkspace(supabase, workspaceId, processId, stepId)
    if (!step) {
      return NextResponse.json({ error: 'Étape introuvable' }, { status: 404 })
    }

    const { error } = await supabase.from('setting_process_steps').delete().eq('id', stepId)

    if (error) {
      return NextResponse.json({ error: "Impossible de supprimer l'étape" }, { status: 500 })
    }

    return NextResponse.json({ data: { id: stepId } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
