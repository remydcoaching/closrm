import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { updateGoalSchema } from '@/lib/validations/goals'
import { authOrServerError, goalsDbError } from '@/lib/goals/api-errors'
import { isDirectChildHorizon, normalizePeriodStart } from '@/lib/goals/period'
import { syncAncestorsDone } from '@/lib/goals/done'
import { moveDescendants } from '@/lib/goals/move'
import { syncSeries } from '@/lib/goals/series'
import { isMissingColumn } from '@/lib/goals/api-errors'

// '*' rather than a list: carried_from (migration 129) shows up as soon as it exists.
const COLS = '*'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { workspaceId, userId } = await getWorkspaceId()
    const parsed = updateGoalSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide', details: parsed.error.flatten() }, { status: 400 })
    const { done, ...rest } = parsed.data
    const supabase = await createClient()

    const { data: current, error: readError } = await supabase.from('goals').select('*').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
    if (readError) return goalsDbError(readError)
    if (!current) return NextResponse.json({ error: 'Objectif introuvable' }, { status: 404 })

    const patch: Record<string, unknown> = { ...rest }
    if (done !== undefined) patch.done_at = done ? new Date().toISOString() : null
    if (rest.period_start !== undefined) patch.period_start = normalizePeriodStart(rest.horizon ?? current.horizon, rest.period_start)
    // Moved to another day without a new time: the old time would sit on the wrong day.
    if (rest.period_start !== undefined && rest.scheduled_at === undefined && current.scheduled_at) patch.scheduled_at = null
    // Repeating: every occurrence of the series shares the first one's id.
    if (rest.repeats === true && !current.series_id) patch.series_id = id
    // A counter goal (« 7/10 ») is done once it reaches its target.
    const target = rest.target !== undefined ? rest.target : current.target
    const progress = rest.progress !== undefined ? rest.progress : current.progress
    if (done === undefined && (rest.progress !== undefined || rest.target !== undefined) && target) {
      patch.done_at = progress >= target ? (current.done_at ?? new Date().toISOString()) : null
    }

    // A parent must be in the same workspace, one level up, and must not create a cycle.
    if (rest.parent_id) {
      const { data: parent } = await supabase.from('goals').select('horizon').eq('id', rest.parent_id).eq('workspace_id', workspaceId).maybeSingle()
      if (parent && !isDirectChildHorizon(parent.horizon, rest.horizon ?? current.horizon)) {
        return NextResponse.json({ error: 'Un sous-objectif se place juste un niveau en dessous (année → trimestre → mois → semaine → jour)' }, { status: 400 })
      }
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
    // Moved to another period or horizon: its sub-goals follow (a sub-goal moved alone: only its own).
    if (rest.horizon !== undefined || rest.period_start !== undefined) await moveDescendants(supabase, workspaceId, current, data)
    // Checking a week slice can check the month goal it belongs to (and so on up).
    // Checking a day slice of a counter goal (« Poster 0/4 » this week) counts it: +1 / −1.
    if (done !== undefined && !!done !== !!current.done_at && data.parent_id) {
      const { data: parent } = await supabase.from('goals').select('*').eq('id', data.parent_id).eq('workspace_id', workspaceId).maybeSingle()
      if (parent?.target) {
        const progress = Math.max(0, (parent.progress ?? 0) + (done ? 1 : -1))
        const done_at = progress >= parent.target ? (parent.done_at ?? new Date().toISOString()) : null
        await supabase.from('goals').update({ progress, done_at }).eq('id', parent.id).eq('workspace_id', workspaceId)
        await syncAncestorsDone(supabase, workspaceId, parent.parent_id)
      }
    }
    if (done !== undefined || 'done_at' in patch) await syncAncestorsDone(supabase, workspaceId, data.parent_id)
    // Repeat switched on, changed or stopped: the coming occurrences follow (created now when it has an end).
    if (rest.repeats !== undefined || rest.repeat_until !== undefined || rest.target !== undefined) {
      await syncSeries(supabase, workspaceId, userId, data)
    }
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
