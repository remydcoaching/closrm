import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateGoalSchema } from '@/lib/validations/goals'
import { authOrServerError, goalsDbError } from '@/lib/goals/api-errors'
import { normalizePeriodStart } from '@/lib/goals/period'
import { syncAncestorsDone } from '@/lib/goals/done'
import { isMissingColumn } from '@/lib/goals/api-errors'

// '*' rather than a list: carried_from (migration 129) shows up as soon as it exists.
const COLS = '*'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const parsed = updateGoalSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide', details: parsed.error.flatten() }, { status: 400 })
    const { done, ...rest } = parsed.data
    const supabase = await createClient()

    const { data: current, error: readError } = await supabase.from('goals').select('id, horizon').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
    if (readError) return goalsDbError(readError)
    if (!current) return NextResponse.json({ error: 'Objectif introuvable' }, { status: 404 })

    const patch: Record<string, unknown> = { ...rest }
    if (done !== undefined) patch.done_at = done ? new Date().toISOString() : null
    if (rest.period_start !== undefined) patch.period_start = normalizePeriodStart(rest.horizon ?? current.horizon, rest.period_start)

    // A parent must be in the same workspace and must not create a cycle.
    if (rest.parent_id) {
      let cursor: string | null = rest.parent_id
      for (let depth = 0; cursor && depth < 10; depth++) {
        if (cursor === id) return NextResponse.json({ error: 'Un objectif ne peut pas être son propre sous-objectif' }, { status: 400 })
        const { data: p }: { data: { parent_id: string | null } | null } = await supabase
          .from('goals').select('parent_id').eq('id', cursor).eq('workspace_id', workspaceId).maybeSingle()
        if (!p) return NextResponse.json({ error: 'Objectif parent introuvable' }, { status: 400 })
        cursor = p.parent_id
      }
    }

    // Rescheduled by hand: it is no longer a carried-over goal.
    if (rest.period_start !== undefined || rest.horizon !== undefined) patch.carried_from = null
    let { data, error } = await supabase.from('goals').update(patch).eq('id', id).eq('workspace_id', workspaceId).select(COLS).single()
    if (error && isMissingColumn(error) && 'carried_from' in patch) {
      delete patch.carried_from // migration 129 not applied yet
      ;({ data, error } = await supabase.from('goals').update(patch).eq('id', id).eq('workspace_id', workspaceId).select(COLS).single())
    }
    if (error) return goalsDbError(error)
    // Checking a week slice can check the month goal it belongs to (and so on up).
    if (done !== undefined) await syncAncestorsDone(supabase, workspaceId, data.parent_id)
    return NextResponse.json({ goal: data })
  } catch (err) {
    return authOrServerError(err)
  }
}

// Sub-goals are removed with it (on delete cascade), like Timestripe.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return goalsDbError(error)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return authOrServerError(err)
  }
}
