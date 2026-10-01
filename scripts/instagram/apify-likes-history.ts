// Likes history of every never-read reel, read once with Apify (when the
// HikerAPI balance is empty), then recorded like a monitor pass.
//
//   npx tsx scripts/instagram/apify-likes-history.ts <workspace_id> [--max-usd 4.9] [--actor datadoping|memo23] [--run <apify_run_id>]
//
// Uses the workspace's own Apify integration (token decrypted in memory, never
// printed). --run re-imports an earlier run's dataset without paying again.
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '../../src/lib/crypto'
import { listReelsFromMeta, loadMonitored } from '../../src/lib/instagram/monitor/run'
import { APIFY_LIKERS_ACTORS, fetchApifyLikers, getApifyRun, historyTargets, importApifyLikers, startApifyLikersRun, type ApifyLikersActor } from '../../src/lib/instagram/monitor/apify-history'
import { mediaIdToShortcode } from '../../src/lib/instagram/shortcode'

const [workspaceId, ...rest] = process.argv.slice(2)
const arg = (name: string) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}
if (!workspaceId) throw new Error('usage: apify-likes-history.ts <workspace_id> [--max-usd 4.9] [--run <id>]')
const maxUsd = Number(arg('--max-usd') ?? 4.9)
const actor = (arg('--actor') ?? 'datadoping') as ApifyLikersActor
if (!(actor in APIFY_LIKERS_ACTORS)) throw new Error(`unknown actor ${actor}`)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const { data: integ, error } = await supabase.from('integrations').select('credentials_encrypted').eq('workspace_id', workspaceId).eq('type', 'apify').eq('is_active', true).single()
  if (error || !integ) throw new Error('No active Apify integration for this workspace')
  const token = (JSON.parse(decrypt(integ.credentials_encrypted)) as { apiToken: string }).apiToken

  let runId = arg('--run')
  if (!runId) {
    await listReelsFromMeta(supabase, workspaceId)
    const targets = historyTargets((await loadMonitored(supabase, workspaceId)).all)
    const urls = targets.map((c) => c.content_url || `https://www.instagram.com/reel/${mediaIdToShortcode(c.content_id)}/`)
    console.log(`${targets.length} reels never read, newest first; spending cap $${maxUsd}`)
    if (urls.length === 0) return
    runId = await startApifyLikersRun(token, actor, urls, maxUsd)
    console.log(`Apify run ${runId} started (${APIFY_LIKERS_ACTORS[actor].id})`)
  }

  let run = await getApifyRun(token, runId)
  while (run.status === 'READY' || run.status === 'RUNNING') {
    await wait(15_000)
    run = await getApifyRun(token, runId)
    console.log(`${new Date().toISOString().slice(11, 19)} ${run.status} · $${(run.usageUsd ?? 0).toFixed(2)}`)
  }
  console.log(`Run ${run.status}, cost $${(run.usageUsd ?? 0).toFixed(2)}`)
  if (!run.datasetId) throw new Error('No dataset')

  const items = await fetchApifyLikers(token, run.datasetId)
  console.log(`${items.length} likers returned`)
  const res = await importApifyLikers(supabase, workspaceId, items, { actor, runId, usageUsd: run.usageUsd })
  console.log(`Imported: ${res.reelsRead} reels read, ${res.newLikes} new likes, ${res.leadsMatched} leads matched${res.errors.length ? ` · errors: ${res.errors.slice(0, 3).join(' | ')}` : ''}`)
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
