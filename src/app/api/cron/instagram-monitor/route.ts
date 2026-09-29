import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { HikerClient } from '@/lib/hiker/client'
import { runMonitor } from '@/lib/instagram/monitor/run'

export const maxDuration = 300

// Hourly (pg_cron, migration 118): one monitor pass per workspace that
// turned the monitor on. Budgets are enforced inside runMonitor.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.HIKER_API_KEY) return NextResponse.json({ skipped: 'hiker_not_configured' })
  const supabase = createServiceClient()
  const { data: enabled, error } = await supabase.from('instagram_monitor_settings').select('workspace_id').eq('enabled', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const results: Record<string, string> = {}
  for (const { workspace_id } of enabled ?? []) {
    try {
      const out = await runMonitor(supabase, workspace_id, (onCall) => new HikerClient({ onCall }), 'cron')
      results[workspace_id] = `${out.status} ${out.requests} req, +${out.newLikes} likes, +${out.newComments} comments`
    } catch (err) {
      results[workspace_id] = `FAILED ${err instanceof Error ? err.message : err}`
    }
  }
  return NextResponse.json({ ran: Object.keys(results).length, results })
}
