import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)[1]
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1]
const supabase = createClient(url, key)

const { data } = await supabase
  .from('integrations')
  .select('workspace_id, type, is_active, connected_at')
  .eq('type', 'youtube')

console.log('YouTube integrations:')
for (const i of (data ?? [])) {
  console.log(`  ws=${i.workspace_id?.slice(0, 8)} active=${i.is_active} connected_at=${i.connected_at}`)
}
console.log(`\nTotal: ${data?.length ?? 0}`)
