import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { startLikersRun, type ApifyCredentials } from '@/lib/apify/client'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * Cron — launches an Apify scrape run for every active watched Instagram
 * post, provided its workspace has an active `apify` integration. Skips
 * posts whose workspace has no active integration instead of failing.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { started: 0, skipped: 0, errors: [] as string[] }

  const { data: watchedPosts, error } = await supabase
    .from('apify_watched_posts')
    .select('id, workspace_id, instagram_post_url')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const post of watchedPosts ?? []) {
    const { data: activeIntegration } = await supabase
      .from('integrations')
      .select('is_active, credentials_encrypted')
      .eq('workspace_id', post.workspace_id)
      .eq('type', 'apify')
      .eq('is_active', true)
      .maybeSingle()

    if (!activeIntegration) {
      results.skipped += 1
      continue
    }

    try {
      let credentials: ApifyCredentials
      try {
        const decrypted = decrypt(activeIntegration.credentials_encrypted)
        credentials = JSON.parse(decrypted)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to decrypt credentials'
        results.errors.push(`Post ${post.id}: Invalid credentials: ${message}`)
        continue
      }

      const { runId, datasetId } = await startLikersRun([post.instagram_post_url], credentials)

      await supabase.from('apify_runs').insert({
        workspace_id: post.workspace_id,
        watched_post_id: post.id,
        apify_run_id: runId,
        apify_dataset_id: datasetId,
        status: 'pending',
      })

      await supabase
        .from('apify_watched_posts')
        .update({ last_run_id: runId, last_checked_at: new Date().toISOString() })
        .eq('id', post.id)

      results.started += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`Post ${post.id}: ${message}`)
    }
  }

  return NextResponse.json(results)
}
