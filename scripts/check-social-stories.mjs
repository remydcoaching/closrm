import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)[1].replace(/\/$/, '')
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)[1]
const supabase = createClient(url, key)

const userEmail = process.argv[2] || 'pr.rebmann@gmail.com'

const { data: u } = await supabase.auth.admin.listUsers()
const user = u.users.find((x) => x.email === userEmail)
if (!user) { console.log('user not found'); process.exit(1) }

const { data: ws } = await supabase
  .from('users')
  .select('workspace_id')
  .eq('id', user.id)
  .maybeSingle()

const workspaceId = ws?.workspace_id
console.log('workspace:', workspaceId)

// Counts globaux
const { count: totalAll } = await supabase
  .from('social_posts')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId)

const { count: storiesAll } = await supabase
  .from('social_posts')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId)
  .eq('content_kind', 'story')

console.log(`Total slots: ${totalAll}`)
console.log(`Total stories (toutes dates): ${storiesAll}`)

// Distribution par mois pour les stories
const { data: storiesData } = await supabase
  .from('social_posts')
  .select('plan_date, status, production_status')
  .eq('workspace_id', workspaceId)
  .eq('content_kind', 'story')
  .order('plan_date', { ascending: true })

if (storiesData?.length) {
  const byMonth = {}
  const byStatus = {}
  const byProd = {}
  for (const s of storiesData) {
    const m = s.plan_date?.slice(0, 7) ?? 'no_date'
    byMonth[m] = (byMonth[m] || 0) + 1
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
    byProd[s.production_status ?? 'null'] = (byProd[s.production_status ?? 'null'] || 0) + 1
  }
  console.log('\nStories par mois:', byMonth)
  console.log('Stories par status:', byStatus)
  console.log('Stories par production_status:', byProd)
  console.log('\nPremière story:', storiesData[0])
  console.log('Dernière story:', storiesData[storiesData.length - 1])
} else {
  console.log('AUCUNE story en DB pour ce workspace.')
}

// Simule la requête slim EXACTE du Board
const now = new Date()
const from = new Date(now.getFullYear(), now.getMonth(), 1)
const to = new Date(now.getFullYear(), now.getMonth() + 2, 0)
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
console.log(`\n--- Simule fetch Board slim (plan_date ${fmt(from)} → ${fmt(to)}, per_page=500) ---`)
const slimFields = 'id,workspace_id,title,hook,status,scheduled_at,published_at,pillar_id,content_kind,production_status,plan_date,slot_index,media_urls,monteur_id,rush_url,final_url,final_versions,montage_deadline,monteur_notified_at,coach_notified_at,pricing_tier_id,paid_at,created_at,updated_at'
const { data: boardRows, error: boardErr } = await supabase
  .from('social_posts')
  .select(slimFields)
  .eq('workspace_id', workspaceId)
  .gte('plan_date', fmt(from))
  .lte('plan_date', fmt(to))
  .order('plan_date', { ascending: true, nullsFirst: false })
  .order('slot_index', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: false })
  .range(0, 499)

if (boardErr) console.log('ERR slim:', boardErr.message)
const byKindLoaded = {}
for (const r of boardRows ?? []) byKindLoaded[r.content_kind] = (byKindLoaded[r.content_kind] || 0) + 1
console.log(`Rows chargées par le Board: ${boardRows?.length ?? 0}`)
console.log('Par kind:', byKindLoaded)

// Simule visiblePosts du Board en mode period='all', filterKind='all', showHistory=false
const today2 = new Date()
const sevenDaysAgo = new Date(today2); sevenDaysAgo.setDate(today2.getDate() - 7)
const cutoff = fmt(sevenDaysAgo)

const visible = (boardRows ?? []).filter((p) => {
  // filterKind='all', filterPillar='all' → skip
  // range.from/to=null (period='all') → skip
  // showHistory=false:
  if (!['draft', 'scheduled', 'failed'].includes(p.status)) return false
  // period === 'all' → cutoff filter SKIPPED
  return true
})
const visibleByKind = {}
for (const r of visible) visibleByKind[r.content_kind] = (visibleByKind[r.content_kind] || 0) + 1
console.log(`\nVisible avec period='all' showHistory=false: ${visible.length}`)
console.log('Par kind:', visibleByKind)
