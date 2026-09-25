import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { startDiscoverySchema } from '@/lib/validations/hiker'
import { HikerClient } from '@/lib/hiker/client'
import { discoverInstagramAccount } from '@/lib/hiker/discovery'
import { persistDiscoveryProfiles } from '@/lib/hiker/persist-profiles'
import { persistDiscoveryContents } from '@/lib/hiker/persist-contents'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * "Ciblage" (renamed from "Instagram Discovery" per product feedback) —
 * triggers a Hiker scan of a public Instagram account and OBSERVES who
 * liked/commented on its content into discovery_profiles (migration 102).
 * This does NOT create a lead for every profile anymore — a scan is
 * read-only intelligence gathering; converting a specific profile into a
 * lead is a separate, explicit action (see
 * [runId]/profiles/[profileId]/target/route.ts, "Cibler"). Auth via the
 * caller's own session (getWorkspaceId) — RLS scopes every write to their
 * workspace, no cross-workspace access is possible. The Hiker API key never
 * leaves the server (HikerClient reads it from process.env only).
 */
export async function POST(request: NextRequest) {
  let workspaceId: string
  let userId: string
  try {
    const ctx = await getWorkspaceId()
    workspaceId = ctx.workspaceId
    userId = ctx.userId
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = startDiscoverySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { instagramUsername, options } = parsed.data

  if (!process.env.HIKER_API_KEY) {
    return NextResponse.json({ error: 'Hiker discovery is not configured on this environment' }, { status: 503 })
  }

  // Use the service client for writes (discovery_runs, leads, instagram_interactions)
  // scoped explicitly by workspaceId in every query below — the caller's own
  // session already proved workspace membership via getWorkspaceId().
  const supabase = createServiceClient()

  const { data: run, error: runInsertError } = await supabase
    .from('discovery_runs')
    .insert({
      workspace_id: workspaceId,
      provider: 'hiker',
      instagram_username: instagramUsername,
      status: 'RUNNING',
      triggered_by: userId,
    })
    .select('id')
    .single()

  if (runInsertError || !run) {
    return NextResponse.json({ error: 'Failed to create discovery run' }, { status: 500 })
  }

  try {
    const result = await discoverInstagramAccount(
      (onCall) => new HikerClient({ onCall }),
      instagramUsername,
      options,
    )

    const persistOutcome = await persistDiscoveryProfiles(supabase, workspaceId, run.id, result)
    const contentsOutcome = await persistDiscoveryContents(supabase, workspaceId, run.id, result)
    const allPersistErrors = [...persistOutcome.errors, ...contentsOutcome.errors]

    await supabase
      .from('discovery_runs')
      .update({
        instagram_user_id: result.account.instagramUserId || null,
        status: result.status,
        stopped_reason: result.stoppedReason,
        contents_found: result.stats.uniqueContentsFetched,
        users_found: result.stats.uniqueUsers,
        interactions_found: result.stats.totalInteractions,
        followers_found: result.stats.followersFetched,
        http_calls: result.stats.httpCalls,
        estimated_billed_requests: result.stats.estimatedBilledRequests,
        errors_count: result.errors.length + allPersistErrors.length,
        completed_at: result.stats.completedAt,
        metadata: { warnings: result.warnings, persistErrors: allPersistErrors },
      })
      .eq('id', run.id)

    return NextResponse.json({
      runId: run.id,
      status: result.status,
      stoppedReason: result.stoppedReason,
      stats: result.stats,
      persisted: {
        profilesObserved: persistOutcome.profilesObserved,
        alreadyLeadsCount: persistOutcome.alreadyLeadsCount,
      },
      warnings: result.warnings,
      errors: [...result.errors.map((e) => `${e.stage} ${e.status} on content ${e.contentId}`), ...allPersistErrors],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase
      .from('discovery_runs')
      .update({ status: 'FAILED', completed_at: new Date().toISOString(), metadata: { error: message } })
      .eq('id', run.id)
    console.error('[api/instagram/discovery] discovery failed:', message)
    return NextResponse.json({ error: 'Discovery failed', runId: run.id }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('discovery_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ runs: data })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
