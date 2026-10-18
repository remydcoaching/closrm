import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePeriodStart } from './period'

// Server copy of the desktop's moveSubtree(): when a goal moves to another
// period or horizon, its whole subtree follows, each sub-goal one level under
// its parent (S42 → S43: Tuesday stays Tuesday; T4 → year: months become quarters).

type Horizon = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'life' | 'inbox'
interface Node { id: string; parent_id: string | null; horizon: Horizon; period_start: string | null }

const CHILD: Record<string, Horizon> = { life: 'year', year: 'quarter', quarter: 'month', month: 'week', week: 'day', day: 'day' }

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const dayDiff = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)

function periodEnd(horizon: Horizon, start: string): string {
  const d = toDate(start)
  switch (horizon) {
    case 'day': return start
    case 'week': return addDays(start, 6)
    case 'month': return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
    case 'quarter': return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 0)))
    default: return iso(new Date(Date.UTC(d.getUTCFullYear(), 11, 31)))
  }
}

function placeChild(child: Node, before: Node, after: Node, today: string): Pick<Node, 'horizon' | 'period_start'> {
  if (after.horizon === 'inbox') return { horizon: 'inbox', period_start: null }
  const horizon = CHILD[after.horizon]
  let date = child.period_start ?? after.period_start ?? today
  if (child.period_start && before.horizon === after.horizon && before.period_start && after.period_start) {
    date = addDays(child.period_start, dayDiff(before.period_start, after.period_start))
  }
  if (after.period_start && after.horizon !== 'life') {
    const end = periodEnd(after.horizon, after.period_start)
    if (date < after.period_start) date = after.period_start
    if (date > end) date = end
  }
  return { horizon, period_start: normalizePeriodStart(horizon, date) }
}

/** Re-places every descendant of `before` (now `after`). Returns how many moved. */
export async function moveDescendants(supabase: SupabaseClient, workspaceId: string, before: Node, after: Node): Promise<number> {
  const today = iso(new Date())
  let count = 0
  const visit = async (b: Node, a: Node, depth: number) => {
    if (depth > 10) return
    const { data: children } = await supabase.from('goals').select('id, parent_id, horizon, period_start').eq('parent_id', b.id).eq('workspace_id', workspaceId)
    for (const child of (children ?? []) as Node[]) {
      const place = placeChild(child, b, a, today)
      if (place.horizon !== child.horizon || place.period_start !== child.period_start) {
        await supabase.from('goals').update(place).eq('id', child.id).eq('workspace_id', workspaceId)
        count++
      }
      await visit(child, { ...child, ...place }, depth + 1)
    }
  }
  await visit(before, after, 0)
  return count
}
