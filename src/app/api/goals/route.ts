import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createGoalSchema, goalsQuerySchema } from '@/lib/validations/goals'
import { authOrServerError, goalsDbError } from '@/lib/goals/api-errors'
import { isDirectChildHorizon, normalizePeriodStart } from '@/lib/goals/period'

// '*' rather than a list: carried_from (migration 129) shows up as soon as it exists.
const COLS = '*'

// GET /api/goals?horizon=week&from=2026-09-01&to=2026-12-31
// Returns the goals of the range plus their direct parents and children
// (any horizon): the parent title is shown under each goal, children as « N sous-objectifs ».
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const parsed = goalsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide', details: parsed.error.flatten() }, { status: 400 })
    const { horizon, from, to } = parsed.data
    const supabase = await createClient()

    let q = supabase.from('goals').select(COLS).eq('workspace_id', workspaceId)
    if (horizon) q = q.eq('horizon', horizon)
    if (horizon !== 'inbox' && horizon !== 'life') {
      if (from) q = q.gte('period_start', from)
      if (to) q = q.lte('period_start', to)
    }
    const { data: main, error } = await q.order('position').limit(2000)
    if (error) return goalsDbError(error)

    const ids = main.map((g) => g.id)
    const parentIds = [...new Set(main.map((g) => g.parent_id).filter((id): id is string => !!id && !ids.includes(id)))]
    const [parents, children] = await Promise.all([
      parentIds.length ? supabase.from('goals').select(COLS).eq('workspace_id', workspaceId).in('id', parentIds) : null,
      ids.length ? supabase.from('goals').select(COLS).eq('workspace_id', workspaceId).in('parent_id', ids).order('position') : null,
    ])
    const byId = new Map(main.map((g) => [g.id, g]))
    for (const g of [...(parents?.data ?? []), ...(children?.data ?? [])]) if (!byId.has(g.id)) byId.set(g.id, g)
    return NextResponse.json({ goals: [...byId.values()] })
  } catch (err) {
    return authOrServerError(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const parsed = createGoalSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide', details: parsed.error.flatten() }, { status: 400 })
    const input = parsed.data
    const supabase = await createClient()

    if (input.parent_id) {
      const { data: parent } = await supabase.from('goals').select('id, horizon').eq('id', input.parent_id).eq('workspace_id', workspaceId).maybeSingle()
      if (!parent) return NextResponse.json({ error: 'Objectif parent introuvable' }, { status: 400 })
      if (!isDirectChildHorizon(parent.horizon, input.horizon)) {
        return NextResponse.json({ error: 'Un sous-objectif se place juste un niveau en dessous (année → trimestre → mois → semaine → jour)' }, { status: 400 })
      }
    }
    const period_start = normalizePeriodStart(input.horizon, input.period_start)

    let position = input.position
    if (position === undefined) {
      let last = supabase.from('goals').select('position').eq('workspace_id', workspaceId).eq('horizon', input.horizon)
      last = period_start ? last.eq('period_start', period_start) : last.is('period_start', null)
      const { data } = await last.order('position', { ascending: false }).limit(1)
      position = (data?.[0]?.position ?? 0) + 1024
    }

    const { data, error } = await supabase
      .from('goals')
      .insert({
        ...input, period_start, position, workspace_id: workspaceId, user_id: userId,
        // A repeating goal starts its own series (its id = the series id).
        ...(input.repeats ? (() => { const id = crypto.randomUUID(); return { id, series_id: id } })() : {}),
      })
      .select(COLS)
      .single()
    if (error) return goalsDbError(error)
    return NextResponse.json({ goal: data }, { status: 201 })
  } catch (err) {
    return authOrServerError(err)
  }
}
