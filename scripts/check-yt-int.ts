import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve('/Users/pierrerebmann/closrm/.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await sb.from('integrations').select('id, workspace_id, type, is_active, connected_at, updated_at').eq('type', 'youtube').limit(10)
  console.log('Integrations YT:', JSON.stringify(data, null, 2))
  const { data: yt } = await sb.from('youtube_accounts').select('id, workspace_id, channel_id, channel_title').limit(10)
  console.log('youtube_accounts:', JSON.stringify(yt, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
