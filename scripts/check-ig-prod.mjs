import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)[1]
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1]
const supabase = createClient(url, key)

// Check IG accounts
const { data: accs, error: accErr } = await supabase
  .from('ig_accounts')
  .select('workspace_id, ig_user_id, is_connected, connected_at, username')

console.log('IG accounts:', accErr?.message ?? '')
for (const a of (accs ?? [])) {
  console.log(`  ws=${a.workspace_id.slice(0, 8)} ig=${a.ig_user_id} username=${a.username} connected=${a.is_connected}`)
}

// Check the failed slot details
const { data: post } = await supabase
  .from('social_posts')
  .select('id, workspace_id, title, status, media_urls, media_type, scheduled_at, publications:social_post_publications(*)')
  .eq('title', 'TES 12334')
  .single()

if (post) {
  console.log('\nSlot "TES 12334":')
  console.log(`  workspace=${post.workspace_id.slice(0, 8)}`)
  console.log(`  status=${post.status}`)
  console.log(`  scheduled_at=${post.scheduled_at}`)
  console.log(`  media_type=${post.media_type}`)
  console.log(`  media_urls=`, post.media_urls)
  console.log(`  publications:`)
  for (const p of post.publications) {
    console.log(`    ${p.platform} status=${p.status} error=${p.error_message ?? '—'}`)
  }
}
