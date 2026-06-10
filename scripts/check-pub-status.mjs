import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)[1]
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1]
const supabase = createClient(url, key)

const { data: pubs } = await supabase
  .from('social_post_publications')
  .select('id, social_post_id, platform, status, scheduled_at, error_message, updated_at, post:social_posts(title, scheduled_at, status)')
  .order('updated_at', { ascending: false })
  .limit(5)

for (const p of pubs) {
  const post = p.post
  console.log(`\n[${p.platform}] status=${p.status}  scheduled_at=${p.scheduled_at}`)
  console.log(`  post: title="${post?.title}" status=${post?.status}`)
  console.log(`  updated_at: ${p.updated_at}`)
  if (p.error_message) console.log(`  ❌ error: ${p.error_message}`)
}

// Check pg_cron jobs
const { data: jobs, error: cronErr } = await supabase
  .from('cron.job')
  .select('jobname, schedule, active')
  .eq('jobname', 'social-posts-tick')

if (cronErr) {
  console.log(`\n[pg_cron] ⚠️  ${cronErr.message} (la table cron.job n'est pas accessible via PostgREST — c'est OK)`)
} else {
  console.log(`\n[pg_cron] social-posts-tick:`, jobs)
}
