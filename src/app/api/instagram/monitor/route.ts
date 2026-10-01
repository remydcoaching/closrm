import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { HikerClient } from '@/lib/hiker/client'
import { requestsUsedToday, runMonitor } from '@/lib/instagram/monitor/run'

export const maxDuration = 300

/**
 * Suivi des publications (HikerAPI, payant — désactivé par défaut).
 * GET  — réglages, requêtes utilisées aujourd'hui, derniers passages, derniers gestes détectés.
 * PUT  — { enabled?, maxRequestsPerDay? }
 * POST — lance un passage maintenant (dans la limite du budget du jour).
 *        { historic: true } : lit une fois les likers de chaque reel jamais lu
 *        (coût confirmé par le coach, hors budget du jour).
 */

const HISTORY_MAX = 500

/** Reels (Meta) whose likers were never read — the cost of a history backfill. */
async function unreadReels(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string): Promise<number> {
  const [reels, read] = await Promise.all([
    supabase.from('ig_reels').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).not('shortcode', 'is', null),
    supabase.from('instagram_monitored_contents').select('content_id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).not('last_scanned_at', 'is', null),
  ])
  return Math.max(0, (reels.count ?? 0) - (read.count ?? 0))
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const [settings, runs, gestures, used, unread] = await Promise.all([
      supabase.from('instagram_monitor_settings').select('enabled, instagram_username, max_requests_per_day').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('instagram_monitor_runs').select('id, trigger, started_at, completed_at, status, requests, contents_scanned, new_likes, new_comments, leads_matched, stopped_reason').eq('workspace_id', workspaceId).order('started_at', { ascending: false }).limit(10),
      supabase
        .from('instagram_engagement_observations')
        .select('id, content_id, interaction_type, instagram_user_id, instagram_username, full_name, profile_pic_url, comment_text, commented_at, first_observed_at, previous_scan_at, matched_lead_id')
        .eq('workspace_id', workspaceId)
        .not('previous_scan_at', 'is', null)
        .order('first_observed_at', { ascending: false })
        .limit(50),
      requestsUsedToday(supabase, workspaceId),
      unreadReels(supabase, workspaceId),
    ])
    if (settings.error && /does not exist|schema cache/i.test(settings.error.message)) {
      return NextResponse.json({ error: 'Migration 118 non appliquée' }, { status: 503 })
    }
    const contentIds = [...new Set((gestures.data ?? []).map((g) => g.content_id))]
    const { data: contents } = contentIds.length
      ? await supabase.from('instagram_monitored_contents').select('content_id, content_type, content_url, thumbnail_url, caption').eq('workspace_id', workspaceId).in('content_id', contentIds)
      : { data: [] }
    return NextResponse.json({
      data: {
        settings: settings.data ?? { enabled: false, instagram_username: null, max_requests_per_day: 50 },
        requestsUsedToday: used,
        hikerConfigured: !!process.env.HIKER_API_KEY,
        unreadReels: unread,
        runs: runs.data ?? [],
        gestures: gestures.data ?? [],
        contents: contents ?? [],
      },
    })
  } catch (err) {
    return failure(err)
  }
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  maxRequestsPerDay: z.number().int().min(10).max(5000).optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    const row: Record<string, unknown> = { workspace_id: workspaceId, updated_at: new Date().toISOString() }
    if (parsed.data.enabled !== undefined) row.enabled = parsed.data.enabled
    if (parsed.data.maxRequestsPerDay !== undefined) row.max_requests_per_day = parsed.data.maxRequestsPerDay
    const { data, error } = await supabase.from('instagram_monitor_settings').upsert(row, { onConflict: 'workspace_id' }).select('enabled, instagram_username, max_requests_per_day').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (err) {
    return failure(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    if (!process.env.HIKER_API_KEY) return NextResponse.json({ error: 'HikerAPI non configuré sur le serveur' }, { status: 503 })
    const body = (await request.json().catch(() => null)) as { historic?: unknown } | null
    let budgetOverride: number | undefined
    if (body?.historic === true) {
      const unread = await unreadReels(await createClient(), workspaceId)
      if (unread === 0) return NextResponse.json({ error: 'Historique déjà récupéré' }, { status: 409 })
      budgetOverride = Math.min(unread, HISTORY_MAX)
    }
    // Service client, every query scoped by workspaceId (membership proven above).
    const outcome = await runMonitor(createServiceClient(), workspaceId, (onCall) => new HikerClient({ onCall }), 'manual', { budgetOverride })
    return NextResponse.json({ data: outcome })
  } catch (err) {
    return failure(err)
  }
}

function failure(err: unknown) {
  if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}
