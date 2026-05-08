/**
 * Suppression des fichiers R2 orphelins (uploades mais non referencies en DB).
 *
 * Croise:
 *  - Tous les objets sous workspaces/* sur R2
 *  - Toutes les valeurs final_url / media_urls / rush_url des social_posts
 * Tout objet R2 non referencie est candidat a la suppression.
 *
 * Usage:
 *   npx tsx scripts/cleanup-r2-orphans.ts          # DRY RUN (liste les orphelins)
 *   npx tsx scripts/cleanup-r2-orphans.ts --apply  # SUPPRIME pour de vrai
 *
 * Securite:
 *  - Dry-run par defaut, suppression demande --apply
 *  - Ignore les objets crees dans les dernieres 60 min (en cours d'upload)
 *  - Affiche un summary avant de confirmer
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

// Charge .env.local AVANT d'importer les modules qui lisent process.env
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
const RECENT_GRACE_MS = 60 * 60 * 1000 // 1h: skip uploads en cours

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { getR2Client, getR2Bucket } = await import('../src/lib/storage/r2-client')
  const r2 = getR2Client()
  const bucket = getR2Bucket()

  console.log(`📦 Bucket R2: ${bucket}`)
  console.log(`Mode: ${apply ? '🔴 APPLY (suppression !)' : '🟡 DRY RUN (no changes)'}`)
  console.log(`Ignore les fichiers < ${RECENT_GRACE_MS / 60000} min (uploads en cours)\n`)

  // 1. Liste R2
  console.log('🔍 Liste R2...')
  const r2Objects: { key: string; size: number; lastModified: Date }[] = []
  let token: string | undefined
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: 'workspaces/', ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue
      r2Objects.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(0),
      })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  console.log(`   ${r2Objects.length} objets sur R2\n`)

  // 2. Liste references DB
  console.log('🗃  Liste des references DB...')
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, final_url, media_urls, rush_url')
  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  const referenced = new Set<string>()
  for (const p of posts ?? []) {
    if (typeof p.final_url === 'string' && p.final_url.startsWith('workspaces/')) {
      referenced.add(p.final_url)
    }
    if (typeof p.rush_url === 'string' && p.rush_url.startsWith('workspaces/')) {
      referenced.add(p.rush_url)
    }
    if (Array.isArray(p.media_urls)) {
      for (const m of p.media_urls) {
        if (typeof m === 'string' && m.startsWith('workspaces/')) {
          referenced.add(m)
        }
      }
    }
  }
  console.log(`   ${referenced.size} paths R2 referencies en DB\n`)

  // 3. Diff: R2 objects qui ne sont referencies nulle part
  const now = Date.now()
  const orphans: { key: string; size: number; ageMin: number }[] = []
  let totalSize = 0
  let skippedRecent = 0

  for (const obj of r2Objects) {
    if (referenced.has(obj.key)) continue
    const age = now - obj.lastModified.getTime()
    if (age < RECENT_GRACE_MS) {
      skippedRecent++
      continue
    }
    orphans.push({ key: obj.key, size: obj.size, ageMin: Math.round(age / 60000) })
    totalSize += obj.size
  }

  console.log(`📋 Orphelins detectes: ${orphans.length}`)
  console.log(`   Skippes (recents): ${skippedRecent}`)
  console.log(`   Espace recuperable: ${(totalSize / 1024 / 1024).toFixed(1)} MB\n`)

  if (orphans.length === 0) {
    console.log('✅ Rien a supprimer.')
    return
  }

  // Trie par age (plus vieux d'abord)
  orphans.sort((a, b) => b.ageMin - a.ageMin)

  for (const o of orphans.slice(0, 50)) {
    const sizeKb = (o.size / 1024).toFixed(0)
    console.log(`  - ${o.key} (${sizeKb} KB, ${o.ageMin} min)`)
  }
  if (orphans.length > 50) {
    console.log(`  ... +${orphans.length - 50} autres\n`)
  }

  if (!apply) {
    console.log('\n🟡 DRY RUN — relance avec --apply pour supprimer.')
    return
  }

  // 4. Suppression par batch de 1000 (limite S3)
  console.log('\n🔴 Suppression en cours...')
  const BATCH = 1000
  let deleted = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH)
    const res = await r2.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map((o) => ({ Key: o.key })) },
    }))
    deleted += (res.Deleted ?? []).length
    if (res.Errors && res.Errors.length > 0) {
      for (const err of res.Errors) {
        console.error(`   ❌ ${err.Key}: ${err.Code} ${err.Message}`)
      }
    }
  }
  console.log(`✅ ${deleted}/${orphans.length} fichiers supprimes (${(totalSize / 1024 / 1024).toFixed(1)} MB liberes)`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
