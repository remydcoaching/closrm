/**
 * Scan R2 bucket for orphan files (uploaded but never linked to a slot).
 * Cross-references with the social_posts table to find slots with empty
 * final_url that have an R2 file matching their post_id.
 *
 * Usage:
 *   npx tsx scripts/recover-orphan-r2-media.ts          # dry-run, just lists
 *   npx tsx scripts/recover-orphan-r2-media.ts --apply  # actually links them
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

// Load .env.local BEFORE importing modules that read env
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[m[1]] = val
  }
}

const apply = process.argv.includes('--apply')

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  // Dynamic import: r2-client lit les env vars au module-load
  const { getR2Client, getR2Bucket } = await import('../src/lib/storage/r2-client')
  const r2 = getR2Client()
  const bucket = getR2Bucket()

  console.log(`📦 R2 bucket: ${bucket}`)
  console.log(`🔍 Scanning for objects with prefix workspaces/...`)
  console.log(`Mode: ${apply ? '🟢 APPLY (will update DB)' : '🟡 DRY RUN (no changes)'}\n`)

  // List all objects under workspaces/ that look like final-*.mp4|mov|webm|...
  let continuationToken: string | undefined
  const allObjects: { key: string; size: number; postId: string; workspaceId: string; kind: 'final' | 'media' | 'rush' }[] = []

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'workspaces/',
      ContinuationToken: continuationToken,
    })
    const res = await r2.send(cmd)
    for (const obj of res.Contents ?? []) {
      const key = obj.Key
      if (!key) continue
      // Path: workspaces/{wid}/posts/{pid}/{kind}-{uuid}.{ext}
      const m = key.match(/^workspaces\/([^/]+)\/posts\/([^/]+)\/(final|media|rush)-/)
      if (!m) continue
      allObjects.push({
        key,
        size: obj.Size ?? 0,
        workspaceId: m[1],
        postId: m[2],
        kind: m[3] as 'final' | 'media' | 'rush',
      })
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  console.log(`Found ${allObjects.length} object(s) under workspaces/\n`)

  // Group by post_id
  const byPost = new Map<string, typeof allObjects>()
  for (const obj of allObjects) {
    const list = byPost.get(obj.postId) ?? []
    list.push(obj)
    byPost.set(obj.postId, list)
  }

  // Fetch all posts that have a matching post_id
  const postIds = Array.from(byPost.keys())
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, workspace_id, title, hook, final_url, media_urls, created_at')
    .in('id', postIds)
  if (error) {
    console.error('Supabase fetch error:', error.message)
    process.exit(1)
  }

  let orphansToRecover = 0
  let recovered = 0

  for (const post of posts ?? []) {
    const objs = byPost.get(post.id) ?? []
    const finals = objs.filter((o) => o.kind === 'final').sort((a, b) => b.key.localeCompare(a.key))
    const hasFinal = !!post.final_url
    if (finals.length > 0 && !hasFinal) {
      // Pick the newest final-*
      const best = finals[0]
      const sizeMB = (best.size / 1024 / 1024).toFixed(1)
      const title = (post.hook || post.title || '(sans titre)').slice(0, 60)
      orphansToRecover++
      console.log(`[ORPHAN] slot=${post.id}`)
      console.log(`  title: ${title}`)
      console.log(`  found: ${best.key} (${sizeMB} MB)`)

      if (apply) {
        const update: { final_url: string; media_urls?: string[] } = { final_url: best.key }
        if (!post.media_urls || (post.media_urls as string[]).length === 0) {
          update.media_urls = [best.key]
        }
        const { error: upErr } = await supabase
          .from('social_posts')
          .update(update)
          .eq('id', post.id)
        if (upErr) {
          console.log(`  ❌ FAILED to link: ${upErr.message}\n`)
        } else {
          recovered++
          console.log(`  ✅ Linked.\n`)
        }
      } else {
        console.log(`  (would link, run with --apply)\n`)
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total R2 objects scanned: ${allObjects.length}`)
  console.log(`Slots with orphan finals: ${orphansToRecover}`)
  if (apply) {
    console.log(`Successfully recovered: ${recovered}`)
  } else {
    console.log(`Run again with --apply to link them in DB.`)
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
