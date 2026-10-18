import type { SupabaseClient } from '@supabase/supabase-js'

// A repeating goal with a duration (« 4 posts par semaine pendant 8 semaines »)
// has all its occurrences created right away, so the coming weeks show it now.
// Without an end date, occurrences are created period by period (rollover).

interface Head {
  id: string
  series_id: string | null
  horizon: string
  period_start: string | null
  title: string
  parent_id: string | null
  target: number | null
  color: string | null
  position: number
  repeats: boolean
  repeat_until?: string | null
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

function nextPeriod(horizon: string, start: string): string {
  const d = toDate(start)
  if (horizon === 'day') d.setUTCDate(d.getUTCDate() + 1)
  else if (horizon === 'week') d.setUTCDate(d.getUTCDate() + 7)
  else d.setUTCMonth(d.getUTCMonth() + 1, 1)
  return iso(d)
}

/** Brings the coming occurrences of `head`'s series in line with it. */
export async function syncSeries(supabase: SupabaseClient, workspaceId: string, userId: string, head: Head) {
  if (!head.series_id || !head.period_start) return
  const { data: future } = await supabase
    .from('goals').select('id, period_start, done_at')
    .eq('workspace_id', workspaceId).eq('series_id', head.series_id).gt('period_start', head.period_start)
  const coming = (future ?? []) as { id: string; period_start: string; done_at: string | null }[]
  const drop = (ids: string[]) => (ids.length ? supabase.from('goals').delete().in('id', ids).eq('workspace_id', workspaceId) : null)

  // Stopped: the coming occurrences not done yet go away.
  if (!head.repeats) {
    await drop(coming.filter((o) => !o.done_at).map((o) => o.id))
    return
  }
  // No end date: one occurrence per period as they come (rollover).
  if (!head.repeat_until) return
  const until = head.repeat_until

  // Shortened: occurrences past the new end go (kept if already done).
  await drop(coming.filter((o) => o.period_start > until && !o.done_at).map((o) => o.id))
  // The ones that stay follow the head (target, title, end date).
  const kept = coming.filter((o) => o.period_start <= until).map((o) => o.id)
  if (kept.length) {
    await supabase.from('goals')
      .update({ title: head.title, target: head.target, repeats: true, repeat_until: until })
      .in('id', kept).eq('workspace_id', workspaceId)
  }
  // Missing periods up to the end are created now.
  const have = new Set(coming.map((o) => o.period_start))
  const rows = []
  for (let p = nextPeriod(head.horizon, head.period_start), guard = 0; p <= until && guard < 400; p = nextPeriod(head.horizon, p), guard++) {
    if (have.has(p)) continue
    rows.push({
      workspace_id: workspaceId, user_id: userId, series_id: head.series_id, title: head.title, horizon: head.horizon,
      period_start: p, parent_id: head.parent_id, repeats: true, repeat_until: until, target: head.target, progress: 0,
      color: head.color, position: head.position,
    })
  }
  if (rows.length) await supabase.from('goals').upsert(rows, { onConflict: 'series_id,period_start', ignoreDuplicates: true })
}
