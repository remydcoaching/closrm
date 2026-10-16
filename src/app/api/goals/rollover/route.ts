import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { authOrServerError, goalsDbError, isMissingColumn } from '@/lib/goals/api-errors'
import { normalizePeriodStart, ROLLING_HORIZONS } from '@/lib/goals/period'

const bodySchema = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

// POST /api/goals/rollover { today } — like Timestripe's auto-move: every goal
// not done whose period is over moves to the current period of its horizon
// (yesterday's → today, last week's → this week…). `today` comes from the
// client so the user's timezone decides when a day is over. Done goals stay
// where they were done.
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Date du jour invalide' }, { status: 400 })
    const supabase = await createClient()

    const rollHorizon = async (horizon: (typeof ROLLING_HORIZONS)[number], withOrigin: boolean) => {
      const current = normalizePeriodStart(horizon, parsed.data.today)!
      const overdue = () =>
        supabase.from('goals').select('id, period_start').eq('workspace_id', workspaceId).eq('horizon', horizon)
          .is('done_at', null).lt('period_start', current)
      const { data: rows, error } = await overdue()
      if (error || !rows?.length) return { moved: 0, error }
      // Keep the first period a goal was planned in (carried_from), one update per original period.
      const byOrigin = new Map<string, string[]>()
      for (const r of rows) byOrigin.set(r.period_start, [...(byOrigin.get(r.period_start) ?? []), r.id])
      if (!withOrigin) {
        const { error: e } = await supabase.from('goals').update({ period_start: current }).in('id', rows.map((r) => r.id)).eq('workspace_id', workspaceId)
        return { moved: e ? 0 : rows.length, error: e }
      }
      // Only goals never carried before get their origin stamped.
      const { error: e1 } = await supabase.from('goals').update({ period_start: current })
        .in('id', rows.map((r) => r.id)).eq('workspace_id', workspaceId).not('carried_from', 'is', null)
      if (e1) return { moved: 0, error: e1 }
      for (const [origin, ids] of byOrigin) {
        const { error: e2 } = await supabase.from('goals').update({ period_start: current, carried_from: origin })
          .in('id', ids).eq('workspace_id', workspaceId).is('carried_from', null)
        if (e2) return { moved: 0, error: e2 }
      }
      return { moved: rows.length, error: null }
    }

    let results = await Promise.all(ROLLING_HORIZONS.map((h) => rollHorizon(h, true)))
    if (results.some((r) => isMissingColumn(r.error))) results = await Promise.all(ROLLING_HORIZONS.map((h) => rollHorizon(h, false)))
    const failed = results.find((r) => r.error)
    if (failed?.error) return goalsDbError(failed.error)
    return NextResponse.json({ moved: results.reduce((n, r) => n + r.moved, 0) })
  } catch (err) {
    return authOrServerError(err)
  }
}
