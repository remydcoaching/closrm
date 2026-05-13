/**
 * Migration script: Supabase Storage `content-drafts` → Cloudflare R2.
 *
 * - Idempotent : ne re-migre pas un fichier deja migre (path R2 reconnaissable
 *   via `workspaces/.../posts/...`).
 * - Dry-run par defaut : passer `--apply` pour ecrire en DB et uploader vers R2.
 * - Safe : si une erreur a mi-parcours, le script peut etre relance, il reprendra
 *   les rows non encore migrees.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-supabase-to-r2.ts                # dry-run
 *   pnpm tsx scripts/migrate-supabase-to-r2.ts --apply        # vraie migration
 *   pnpm tsx scripts/migrate-supabase-to-r2.ts --apply --limit 5  # tester sur 5 posts
 */

import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'

try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // .env.local optionnel
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_ENDPOINT = process.env.R2_ENDPOINT!
const R2_BUCKET = process.env.R2_BUCKET!

if (!SUPA_URL || !SUPA_SERVICE_KEY) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
  console.error('Missing R2 env vars')
  process.exit(1)
}

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const LIMIT = (() => {
  const idx = argv.indexOf('--limit')
  if (idx === -1) return Infinity
  return parseInt(argv[idx + 1] ?? '0', 10) || Infinity
})()

const supa = createClient(SUPA_URL, SUPA_SERVICE_KEY, {
  auth: { persistSession: false },
})

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

interface Post {
  id: string
  workspace_id: string
  final_url: string | null
  media_urls: string[] | null
}

const SUPA_STORAGE_PREFIX = `${SUPA_URL}/storage/v1/object/public/content-drafts/`

function isSupabaseUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/content-drafts/')
}

function extractSupabasePath(url: string): string | null {
  const idx = url.indexOf('/content-drafts/')
  if (idx === -1) return null
  return url.slice(idx + '/content-drafts/'.length).split('?')[0]
}

function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp4':
    case 'm4v': return 'video/mp4'
    case 'mov': return 'video/quicktime'
    case 'webm': return 'video/webm'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

async function downloadFromSupabase(supaPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const { data, error } = await supa.storage.from('content-drafts').download(supaPath)
  if (error || !data) throw new Error(`Supabase download failed for ${supaPath}: ${error?.message ?? 'no data'}`)
  const ab = await data.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType: data.type || inferContentType(supaPath) }
}

async function uploadToR2(workspaceId: string, postId: string, target: 'final' | 'media', filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const safeExt = ext.length > 0 && ext.length <= 6 ? ext : 'bin'
  const path = `workspaces/${workspaceId}/posts/${postId}/${target}-${randomUUID()}.${safeExt}`

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  return path
}

async function migratePost(post: Post): Promise<{ migrated: boolean; changes: string[] }> {
  const changes: string[] = []
  let newFinalUrl = post.final_url
  let newMediaUrls = post.media_urls ?? []

  // final_url
  if (post.final_url && isSupabaseUrl(post.final_url)) {
    const supaPath = extractSupabasePath(post.final_url)
    if (supaPath) {
      changes.push(`final_url: ${supaPath}`)
      if (APPLY) {
        const { buffer, contentType } = await downloadFromSupabase(supaPath)
        const newPath = await uploadToR2(post.workspace_id, post.id, 'final', supaPath, buffer, contentType)
        newFinalUrl = newPath
        changes[changes.length - 1] += ` → ${newPath}`
      }
    }
  }

  // media_urls
  for (let i = 0; i < newMediaUrls.length; i++) {
    const url = newMediaUrls[i]
    if (isSupabaseUrl(url)) {
      const supaPath = extractSupabasePath(url)
      if (supaPath) {
        changes.push(`media_urls[${i}]: ${supaPath}`)
        if (APPLY) {
          const { buffer, contentType } = await downloadFromSupabase(supaPath)
          const newPath = await uploadToR2(post.workspace_id, post.id, 'media', supaPath, buffer, contentType)
          newMediaUrls = [...newMediaUrls]
          newMediaUrls[i] = newPath
          changes[changes.length - 1] += ` → ${newPath}`
        }
      }
    }
  }

  if (changes.length === 0) return { migrated: false, changes }

  if (APPLY) {
    const { error } = await supa
      .from('social_posts')
      .update({ final_url: newFinalUrl, media_urls: newMediaUrls })
      .eq('id', post.id)
    if (error) throw new Error(`DB update failed for post ${post.id}: ${error.message}`)
  }

  return { migrated: true, changes }
}

async function main() {
  console.log(`[migrate-supabase-to-r2] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} limit=${LIMIT === Infinity ? 'all' : LIMIT}`)

  // Lister les posts avec une URL Supabase active
  const { data: posts, error } = await supa
    .from('social_posts')
    .select('id, workspace_id, final_url, media_urls')
    .or(`final_url.like.%${SUPA_STORAGE_PREFIX}%,media_urls.cs.{${SUPA_STORAGE_PREFIX}%}`)

  if (error) {
    console.error('Failed to query posts:', error.message)
    process.exit(1)
  }

  // Filtrer cote client : Supabase ne supporte pas pleinement les filtres array+like
  const candidates = (posts as Post[]).filter((p) => {
    const finalIsSupa = !!p.final_url && isSupabaseUrl(p.final_url)
    const mediaIsSupa = (p.media_urls ?? []).some((u) => isSupabaseUrl(u))
    return finalIsSupa || mediaIsSupa
  })

  console.log(`Found ${candidates.length} posts to migrate`)

  let processed = 0
  let migrated = 0
  let errors = 0

  for (const post of candidates.slice(0, LIMIT)) {
    processed++
    try {
      const result = await migratePost(post)
      if (result.migrated) {
        migrated++
        console.log(`✓ [${processed}/${Math.min(candidates.length, LIMIT)}] post ${post.id}`)
        result.changes.forEach((c) => console.log(`    ${c}`))
      }
    } catch (e) {
      errors++
      console.error(`✗ post ${post.id}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`\nDone. processed=${processed} migrated=${migrated} errors=${errors}`)
  if (!APPLY) console.log('(dry-run; pass --apply to actually migrate)')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
