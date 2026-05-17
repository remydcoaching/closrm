import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)[1]
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1]
const supabase = createClient(url, key)

const { data: yt } = await supabase
  .from('social_post_publications')
  .select('id, social_post_id, status, scheduled_at, error_message, created_at, updated_at')
  .eq('platform', 'youtube')
  .order('updated_at', { ascending: false })
  .limit(10)

console.log('Last 10 YouTube publications:')
for (const p of (yt ?? [])) {
  console.log(`  ${p.updated_at} status=${p.status} ${p.error_message ? '❌ ' + p.error_message.slice(0, 80) : ''}`)
}

// Check integration token expiry
const { data: ints } = await supabase
  .from('integrations')
  .select('workspace_id, type, is_active, connected_at, last_sync_at, credentials_encrypted')
  .eq('type', 'youtube')

console.log('\nYT Integrations:')
for (const i of (ints ?? [])) {
  const hasCreds = !!i.credentials_encrypted
  console.log(`  ws=${i.workspace_id?.slice(0, 8)} active=${i.is_active} connected=${i.connected_at} last_sync=${i.last_sync_at} has_creds=${hasCreds}`)
}
