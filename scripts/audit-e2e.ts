import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve('/Users/pierrerebmann/closrm/.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    process.env[m[1]] = v
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function check() {
  const checks: Array<{ name: string; ok: boolean; detail?: string }> = []

  // 1. resolved_at column on social_post_messages (mig 072)
  {
    const { data, error } = await sb.rpc('information_schema_columns' as never).select() as never
    void data; void error
  }
  // Cleaner: a direct query via SQL is simpler. Use raw fetch.
  async function sql(query: string): Promise<unknown[] | null> {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`
    void url
    return null
  }
  void sql

  // Use simple table introspection via 1-row select
  const tests = [
    { name: 'social_post_messages.resolved_at (mig 072)', tbl: 'social_post_messages', col: 'resolved_at' },
    { name: 'social_post_messages.resolved_by (mig 072)', tbl: 'social_post_messages', col: 'resolved_by' },
    { name: 'social_posts.final_versions (mig 074)',      tbl: 'social_posts',         col: 'final_versions' },
    { name: 'social_posts.montage_deadline (mig 074)',     tbl: 'social_posts',         col: 'montage_deadline' },
    { name: 'social_posts.monteur_id (mig 065)',           tbl: 'social_posts',         col: 'monteur_id' },
    { name: 'social_posts.rush_url (mig 065)',             tbl: 'social_posts',         col: 'rush_url' },
    { name: 'social_posts.final_url (mig 065)',            tbl: 'social_posts',         col: 'final_url' },
  ]
  for (const t of tests) {
    const { error } = await sb.from(t.tbl).select(t.col).limit(1)
    checks.push({ name: t.name, ok: !error, detail: error?.message })
  }

  // 2. Check that there's at least one workspace + monteur for testing
  const { data: members } = await sb
    .from('workspace_members')
    .select('user_id, workspace_id, role, status')
    .eq('role', 'monteur')
    .eq('status', 'active')
  checks.push({ name: 'Au moins 1 monteur actif en DB', ok: (members?.length ?? 0) > 0, detail: `${members?.length ?? 0} monteur(s) actif(s)` })

  // 3. Check existing slots state distribution
  const { data: slots } = await sb
    .from('social_posts')
    .select('id, production_status, status, monteur_id, final_url, montage_deadline, final_versions')
    .limit(50)
  const byStatus: Record<string, number> = {}
  for (const s of (slots ?? []) as { production_status: string }[]) {
    byStatus[s.production_status ?? 'null'] = (byStatus[s.production_status ?? 'null'] ?? 0) + 1
  }
  checks.push({ name: 'Distribution production_status', ok: true, detail: JSON.stringify(byStatus) })

  // 4. Check pubs table
  const { error: pubErr } = await sb.from('social_post_publications').select('id').limit(1)
  checks.push({ name: 'Table social_post_publications accessible', ok: !pubErr, detail: pubErr?.message })

  // 5. Check final_versions trigger applies — pick a slot with final_url and verify final_versions has at least 1 entry
  const slotsWithFinal = (slots ?? []) as Array<{ id: string; final_url: string | null; final_versions: unknown[] | null }>
  const slotWithFinal = slotsWithFinal.find(s => s.final_url)
  if (slotWithFinal) {
    const versions = slotWithFinal.final_versions ?? []
    const hasV = Array.isArray(versions) && versions.length > 0
    checks.push({ name: `Trigger versioning sur slot ${slotWithFinal.id.slice(0, 8)}…`, ok: hasV, detail: `${(versions as unknown[]).length} version(s)` })
  }

  // 6. Check connected platform accounts (any IG/YT account at all)
  const { data: igAccounts } = await sb.from('ig_accounts').select('id, ig_user_id').limit(5)
  const { data: ytAccounts } = await sb.from('youtube_accounts').select('id, channel_id').limit(5)
  checks.push({ name: 'Comptes IG connectés', ok: true, detail: `${igAccounts?.length ?? 0}` })
  checks.push({ name: 'Comptes YouTube connectés', ok: true, detail: `${ytAccounts?.length ?? 0}` })

  // Print
  console.log('\n=== AUDIT E2E ===\n')
  for (const c of checks) {
    const icon = c.ok ? '✅' : '❌'
    console.log(`${icon} ${c.name}${c.detail ? '  →  ' + c.detail : ''}`)
  }
  const failed = checks.filter(c => !c.ok).length
  console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${failed} échec(s) sur ${checks.length} checks`)
}

check().catch(e => { console.error('Audit failed:', e); process.exit(1) })
