/**
 * GET  /api/ads-thresholds  → workspace overrides (or {} if none yet)
 * PUT  /api/ads-thresholds  → upsert workspace overrides
 *
 * Shape: { [kpiKey]: { green?: number, orange?: number } }
 *
 * Only `green` and `orange` are user-tunable. Direction, label and unit
 * stay locked in the frontend defaults (DEFAULT_THRESHOLDS) so the
 * coach can't accidentally invert the meaning of a KPI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

type Overrides = Record<string, { green?: number; orange?: number; red?: number }>

function sanitize(raw: unknown): Overrides {
  if (!raw || typeof raw !== 'object') return {}
  const out: Overrides = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue
    const entry: { green?: number; orange?: number; red?: number } = {}
    const rec = v as Record<string, unknown>
    if (typeof rec.green === 'number' && Number.isFinite(rec.green)) entry.green = rec.green
    if (typeof rec.orange === 'number' && Number.isFinite(rec.orange)) entry.orange = rec.orange
    if (typeof rec.red === 'number' && Number.isFinite(rec.red)) entry.red = rec.red
    if (Object.keys(entry).length > 0) out[k] = entry
  }
  return out
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data } = await supabase
      .from('ads_health_thresholds')
      .select('thresholds')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    return NextResponse.json({ data: (data?.thresholds as Overrides | null) ?? {} })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('[ads-thresholds] GET error', err)
    return NextResponse.json({ data: {}, error: 'server_error' })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await req.json().catch(() => null) as { thresholds?: unknown } | null
    const thresholds = sanitize(body?.thresholds)

    const { error } = await supabase
      .from('ads_health_thresholds')
      .upsert({
        workspace_id: workspaceId,
        thresholds,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' })

    if (error) {
      console.error('[ads-thresholds] PUT error', error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ data: thresholds })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    console.error('[ads-thresholds] PUT unhandled', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
