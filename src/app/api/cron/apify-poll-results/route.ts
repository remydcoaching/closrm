import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRunStatus, getDatasetItems, type ApifyCredentials } from '@/lib/apify/client'
import { processLikersDataset } from '@/lib/apify/process-likers'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * Cron — polls all pending/running Apify runs. For each run, looks up the
 * decrypted Apify credentials for that run's own workspace (credentials are
 * per-workspace, not a single global env var), checks the run status, and
 * once a run succeeds, fetches its dataset and processes the likers into
 * lead interactions.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { processed: 0, stillRunning: 0, failed: 0, errors: [] as string[] }

  const { data: pendingRuns, error } = await supabase
    .from('apify_runs')
    .select('id, workspace_id, watched_post_id, apify_run_id, apify_dataset_id')
    .in('status', ['pending', 'running'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const run of pendingRuns ?? []) {
    try {
      const { data: activeIntegration } = await supabase
        .from('integrations')
        .select('is_active, credentials_encrypted')
        .eq('workspace_id', run.workspace_id)
        .eq('type', 'apify')
        .eq('is_active', true)
        .maybeSingle()

      if (!activeIntegration) {
        results.errors.push(`Run ${run.apify_run_id}: No active Apify integration for workspace ${run.workspace_id}`)
        continue
      }

      let credentials: ApifyCredentials
      try {
        const decrypted = decrypt(activeIntegration.credentials_encrypted)
        credentials = JSON.parse(decrypted)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to decrypt credentials'
        results.errors.push(`Run ${run.apify_run_id}: Invalid credentials: ${message}`)
        continue
      }

      const { status, defaultDatasetId } = await getRunStatus(run.apify_run_id, credentials)

      if (status === 'RUNNING' || status === 'READY') {
        await supabase.from('apify_runs').update({ status: 'running' }).eq('id', run.id)
        results.stillRunning += 1
        continue
      }

      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        await supabase
          .from('apify_runs')
          .update({ status: 'failed', finished_at: new Date().toISOString() })
          .eq('id', run.id)
        results.failed += 1
        continue
      }

      // status === 'SUCCEEDED'
      const datasetId = defaultDatasetId ?? run.apify_dataset_id
      if (!datasetId) {
        throw new Error(`Run ${run.apify_run_id} succeeded but has no dataset id`)
      }

      const { data: watchedPost } = await supabase
        .from('apify_watched_posts')
        .select('id, instagram_post_url')
        .eq('id', run.watched_post_id)
        .single()

      if (!watchedPost) {
        throw new Error(`Watched post ${run.watched_post_id} not found`)
      }

      const items = await getDatasetItems(datasetId, credentials)
      const processResult = await processLikersDataset(
        supabase,
        run.workspace_id,
        watchedPost.id,
        watchedPost.instagram_post_url,
        items,
      )

      await supabase
        .from('apify_runs')
        .update({
          status: 'succeeded',
          items_processed: items.length,
          finished_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      await supabase
        .from('apify_watched_posts')
        .update({ likers_count: items.length })
        .eq('id', watchedPost.id)

      results.processed += 1
      void processResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`Run ${run.apify_run_id}: ${message}`)
    }
  }

  return NextResponse.json(results)
}
