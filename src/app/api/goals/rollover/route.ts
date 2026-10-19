import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { authOrServerError, goalsDbError, isMissingColumn } from '@/lib/goals/api-errors'
import { normalizePeriodStart, ROLLING_HORIZONS } from '@/lib/goals/period'

const bodySchema = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

type Rolling = (typeof ROLLING_HORIZONS)[number]

/** Which optional columns exist yet (migrations 129 and 130 may not be applied). */
async function columnsPresent(supabase: SupabaseClient) {
  const probe = async (col: string) => !isMissingColumn((await supabase.from('goals').select(col).limit(1)).error)
  const [carried, repeats, scheduled, until] = await Promise.all([
    probe('carried_from'), probe('repeats'), probe('scheduled_at'), probe('repeat_until'),
  ])
  return { carried, repeats, scheduled, until }
}

// POST /api/goals/rollover { today } — run when the Objectifs page opens:
// 1. like Timestripe's auto-move, every goal not done whose period is over
//    moves to the current period of its horizon (yesterday's → today…);
//    repeating goals are left out: a missed week stays missed;
// 2. every repeating series gets its occurrence for the current period
//    (« Poster 10 contenus » back at 0/10 each Monday).
// `today` comes from the client so the user's timezone decides when a day is over.
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceId()
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Date du jour invalide' }, { status: 400 })
    const today = parsed.data.today
    const supabase = await createClient()
    const has = await columnsPresent(supabase)

    // ── 1. carry unfinished goals over ────────────────────────────────────
    const rollHorizon = async (horizon: Rolling) => {
      const current = normalizePeriodStart(horizon, today)!
      // A carried-over day goal goes back to the strip: yesterday's 9:00 means nothing today.
      const moveTo = { period_start: current, ...(has.scheduled && horizon === 'day' ? { scheduled_at: null } : {}) }
      let q = supabase.from('goals').select('id, period_start').eq('workspace_id', workspaceId).eq('horizon', horizon)
        .is('done_at', null).lt('period_start', current)
      if (has.repeats) q = q.eq('repeats', false).is('series_id', null)
      const { data: rows, error } = await q
      if (error || !rows?.length) return { moved: 0, error }
      if (!has.carried) {
        const { error: e } = await supabase.from('goals').update(moveTo).in('id', rows.map((r) => r.id)).eq('workspace_id', workspaceId)
        return { moved: e ? 0 : rows.length, error: e }
      }
      // Keep the first period a goal was planned in (carried_from), one update per original period.
      const { error: e1 } = await supabase.from('goals').update(moveTo)
        .in('id', rows.map((r) => r.id)).eq('workspace_id', workspaceId).not('carried_from', 'is', null)
      if (e1) return { moved: 0, error: e1 }
      const byOrigin = new Map<string, string[]>()
      for (const r of rows) byOrigin.set(r.period_start, [...(byOrigin.get(r.period_start) ?? []), r.id])
      for (const [origin, ids] of byOrigin) {
        const { error: e2 } = await supabase.from('goals').update({ ...moveTo, carried_from: origin })
          .in('id', ids).eq('workspace_id', workspaceId).is('carried_from', null)
        if (e2) return { moved: 0, error: e2 }
      }
      return { moved: rows.length, error: null }
    }
    const rolled = await Promise.all(ROLLING_HORIZONS.map(rollHorizon))
    const failed = rolled.find((r) => r.error)
    if (failed?.error) return goalsDbError(failed.error)
    let moved = rolled.reduce((n, r) => n + r.moved, 0)

    // ── 2. repeating series: this period's occurrence ─────────────────────
    if (has.repeats) {
      const { data: occurrences, error } = await supabase.from('goals')
        .select('*') // repeat_until (migration 132) comes along once it exists
        .eq('workspace_id', workspaceId).not('series_id', 'is', null)
      if (error) return goalsDbError(error)
      type Occurrence = {
        series_id: string; title: string; horizon: string; period_start: string | null; parent_id: string | null
        repeats: boolean; target: number | null; color: string | null; position: number; repeat_until?: string | null
      }
      const rows = (occurrences ?? []) as Occurrence[]
      // The latest occurrence of each series decides: still repeating, and behind?
      const latest = new Map<string, Occurrence>()
      for (const o of rows) {
        const cur = latest.get(o.series_id)
        if (!cur || (o.period_start ?? '') > (cur.period_start ?? '')) latest.set(o.series_id, o)
      }
      const fresh = [...latest.values()]
        .filter((o) => o.repeats && (ROLLING_HORIZONS as readonly string[]).includes(o.horizon) && o.period_start)
        .map((o) => ({ o, current: normalizePeriodStart(o.horizon, today)! }))
        .filter(({ o, current }) => o.period_start! < current)
        // « pendant 8 semaines »: past its last period, the series stops.
        .filter(({ o, current }) => !o.repeat_until || current <= o.repeat_until)
        .map(({ o, current }) => ({
          workspace_id: workspaceId, user_id: userId, series_id: o.series_id, title: o.title, horizon: o.horizon,
          period_start: current, parent_id: o.parent_id, repeats: true, target: o.target, progress: 0,
          color: o.color, position: o.position,
          ...(has.until ? { repeat_until: o.repeat_until ?? null } : {}),
        }))
      if (fresh.length) {
        // One per series and period (unique index): opening the page twice at once creates it once.
        const { error: e } = await supabase.from('goals').upsert(fresh, { onConflict: 'series_id,period_start', ignoreDuplicates: true })
        if (e) return goalsDbError(e)
        moved += fresh.length
      }
    }

    return NextResponse.json({ moved })
  } catch (err) {
    return authOrServerError(err)
  }
}
