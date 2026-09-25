// Full Hiker Discovery POC runner. Backend/local only. Never writes to ClosRM DB,
// never touches Apify/Meta/dm_sessions. Never logs HIKER_API_KEY.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HikerClient, callLogs } from './hiker-client'
import { runDiscovery, type DiscoveryLimits } from './discovery'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envPath = resolve(__dirname, '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HIKER_API_KEY = process.env.HIKER_API_KEY
const TEST_USERNAME = process.env.TEST_USERNAME

if (!HIKER_API_KEY) {
  console.error('Missing HIKER_API_KEY in scripts/hiker-poc/.env.local')
  process.exit(1)
}
if (!TEST_USERNAME) {
  console.error('Missing TEST_USERNAME in scripts/hiker-poc/.env.local — refusing to run a random discovery.')
  process.exit(1)
}

// Reasonable caps for a POC — not artificial content limits (10/20 posts), but a ceiling
// on total pagination depth so the run stays bounded in cost/time on a test account.
// The account has media_count=60 (confirmed via profile probe), so these caps are set
// above that to guarantee full pagination coverage without runaway cost on a larger account.
const limits: DiscoveryLimits = {
  maxMediaPages: 10, // 12 items/page confirmed via probe -> up to 120 media
  maxClipsPages: 10, // up to 120 clips
  maxFollowerPages: 30, // page size unknown until probed live; generous cap
  maxMediaForLikersAndComments: 25, // safety cap on per-content fan-out (likers+comments calls)
}

async function main() {
  const client = new HikerClient(HIKER_API_KEY!)
  const startedAt = Date.now()

  console.log(`Starting Hiker discovery for @${TEST_USERNAME}...`)
  const result = await runDiscovery(client, TEST_USERNAME!, limits)
  const durationMs = Date.now() - startedAt

  const profiles = result.dedup.allProfiles()

  // Cost estimate — pricing tiers per hikerapi.com/pricing at time of POC (2026-09-18):
  // START $0.02/req (unlock $20), STANDARD $0.001/req (unlock $100),
  // BUSINESS $0.00069/req (unlock $300), ULTRA $0.0006/req (unlock $599).
  const totalHttpCalls = callLogs.length
  const totalBilledRequests = callLogs.reduce((sum, c) => sum + c.estimated_billed_requests, 0)
  const callsByEndpoint: Record<string, number> = {}
  const billedByEndpoint: Record<string, number> = {}
  for (const c of callLogs) {
    callsByEndpoint[c.endpoint] = (callsByEndpoint[c.endpoint] ?? 0) + 1
    billedByEndpoint[c.endpoint] = (billedByEndpoint[c.endpoint] ?? 0) + c.estimated_billed_requests
  }

  const PRICING_TIERS = [
    { name: 'START', unlockAt: 20, perRequest: 0.02 },
    { name: 'STANDARD', unlockAt: 100, perRequest: 0.001 },
    { name: 'BUSINESS', unlockAt: 300, perRequest: 0.00069 },
    { name: 'ULTRA', unlockAt: 599, perRequest: 0.0006 },
  ]

  const errorCalls = callLogs.filter((c) => c.status !== 200)
  const rateLimited = callLogs.filter((c) => c.status === 429)
  const latencies = callLogs.filter((c) => c.status === 200).map((c) => c.duration_ms)
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
  const maxLatency = latencies.length ? Math.max(...latencies) : 0
  const minLatency = latencies.length ? Math.min(...latencies) : 0

  const likersTotalReturned = result.likersCoverage.reduce((sum, l) => sum + l.likers_returned, 0)
  const commentsTotalReturned = result.commentsResults.reduce((sum, c) => sum + c.comments_returned, 0)
  const avgLikerCoverage =
    result.likersCoverage.filter((l) => l.coverage_pct != null).length > 0
      ? result.likersCoverage.reduce((sum, l) => sum + (l.coverage_pct ?? 0), 0) /
        result.likersCoverage.filter((l) => l.coverage_pct != null).length
      : null

  const output = {
    meta: {
      generated_at: new Date().toISOString(),
      test_username: TEST_USERNAME,
      target_instagram_user_id: result.targetInstaId,
      hikerapi_openapi_version_audited: '1.8.1',
      duration_ms: durationMs,
    },
    profile: {
      username: (result.profile as Record<string, unknown>).username,
      full_name: (result.profile as Record<string, unknown>).full_name,
      media_count: (result.profile as Record<string, unknown>).media_count,
      follower_count: (result.profile as Record<string, unknown>).follower_count,
      following_count: (result.profile as Record<string, unknown>).following_count,
      is_private: (result.profile as Record<string, unknown>).is_private,
      is_verified: (result.profile as Record<string, unknown>).is_verified,
    },
    endpoints_used: {
      media: result.mediaEndpointUsed,
      clips: result.clipsEndpointUsed,
      followers: result.followersEndpointUsed,
    },
    content: {
      media_fetched: result.media.length,
      clips_fetched: result.clips.length,
      unique_content_analyzed_for_likers_and_comments: Math.min(
        limits.maxMediaForLikersAndComments,
        result.media.length + result.clips.length,
      ),
    },
    followers: {
      total_fetched: result.followers.length,
    },
    stories: {
      active_stories_count: result.stories.length,
    },
    likers: {
      media_analyzed: result.likersCoverage.length,
      total_likers_returned: likersTotalReturned,
      average_coverage_pct: avgLikerCoverage,
      per_media: result.likersCoverage,
    },
    comments: {
      media_analyzed: result.commentsResults.length,
      total_comments_returned: commentsTotalReturned,
      per_media: result.commentsResults,
    },
    deduplication: {
      unique_users_identified: profiles.length,
      total_interactions_recorded: result.interactionsCount,
    },
    top_engaged_profiles: profiles
      .slice()
      .sort((a, b) => b.n_likes + b.n_comments - (a.n_likes + a.n_comments))
      .slice(0, 20)
      .map((p) => ({
        username: p.username,
        instagram_user_id: p.instagram_user_id,
        n_likes: p.n_likes,
        n_comments: p.n_comments,
        liked_media_count: p.liked_media_count,
        commented_media_count: p.commented_media_count,
        follows_target: p.follows_target,
        sources: Array.from(p.sources),
      })),
    http: {
      total_http_calls: totalHttpCalls,
      total_estimated_billed_requests: totalBilledRequests,
      calls_by_endpoint: callsByEndpoint,
      billed_requests_by_endpoint: billedByEndpoint,
      errors: errorCalls.map((c) => ({ endpoint: c.endpoint, status: c.status, error: c.error })),
      rate_limited_calls: rateLimited.length,
      latency_ms: { avg: Math.round(avgLatency), min: minLatency, max: maxLatency },
    },
    cost_estimate: {
      pricing_tiers_audited_at: '2026-09-18',
      note: 'Actual cost depends on which tier is unlocked on the account balance; not assumed here.',
      by_tier: PRICING_TIERS.map((t) => ({
        tier: t.name,
        per_request_usd: t.perRequest,
        estimated_cost_usd: Math.round(totalBilledRequests * t.perRequest * 100) / 100,
      })),
    },
    discovery_errors: result.errors,
    call_log: callLogs, // no secrets included — verified: only endpoint/status/duration/items
  }

  const resultsPath = resolve(__dirname, 'hiker-poc-results.json')
  writeFileSync(resultsPath, JSON.stringify(output, null, 2))

  console.log(`\nDone in ${durationMs}ms.`)
  console.log(`Unique users: ${profiles.length}, interactions: ${result.interactionsCount}`)
  console.log(`HTTP calls: ${totalHttpCalls}, billed requests (est.): ${totalBilledRequests}`)
  console.log(`Results written to ${resultsPath}`)
}

main().catch((e) => {
  console.error('Discovery failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
