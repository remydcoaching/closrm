// Script to seed fake data — run with: npx tsx scripts/seed.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hsnqmjsckekbmmwneybb.supabase.co',
  // Use service role key to bypass RLS
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzbnFtanNja2VrYm1td25leWJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1NTY5OSwiZXhwIjoyMDkwMTMxNjk5fQ.OYvt8EEoBi6CvPRBcuLIwhkY_MN_5zxUxuAeTYZZYhE'
)

async function seed() {
  // 1. Get workspace_id from first user
  const { data: users } = await supabase.from('users').select('workspace_id').limit(1)
  if (!users || users.length === 0) { console.log('No users found. Register first.'); return }
  const workspaceId = users[0].workspace_id
  console.log('Workspace:', workspaceId)

  // 2. Create 12 leads
  const leads = [
    { first_name: 'Sophie', last_name: 'Martin', phone: '06 12 34 56 78', email: 'sophie.m@gmail.com', source: 'facebook_ads', status: 'closing_planifie', tags: ['chaud', 'VIP'], call_attempts: 3, reached: true },
    { first_name: 'Thomas', last_name: 'Lefèvre', phone: '06 23 45 67 89', email: 'thomas.l@gmail.com', source: 'instagram_ads', status: 'setting_planifie', tags: ['chaud'], call_attempts: 1, reached: true },
    { first_name: 'Marie', last_name: 'Kowalski', phone: '06 34 56 78 90', email: 'marie.k@hotmail.com', source: 'facebook_ads', status: 'nouveau', tags: ['froid'], call_attempts: 0, reached: false },
    { first_name: 'Lucas', last_name: 'Durand', phone: '06 45 67 89 01', email: 'lucas.d@outlook.com', source: 'manuel', status: 'clos', tags: ['VIP', 'referral'], call_attempts: 4, reached: true },
    { first_name: 'Emma', last_name: 'Bernard', phone: '06 56 78 90 12', email: 'emma.b@gmail.com', source: 'facebook_ads', status: 'no_show_setting', tags: ['froid'], call_attempts: 2, reached: false },
    { first_name: 'Hugo', last_name: 'Robert', phone: '06 67 89 01 23', email: 'hugo.r@yahoo.fr', source: 'instagram_ads', status: 'closing_planifie', tags: ['chaud'], call_attempts: 2, reached: true },
    { first_name: 'Léa', last_name: 'Moreau', phone: '06 78 90 12 34', email: 'lea.m@gmail.com', source: 'formulaire', status: 'nouveau', tags: [], call_attempts: 0, reached: false },
    { first_name: 'Nathan', last_name: 'Simon', phone: '06 89 01 23 45', email: 'nathan.s@gmail.com', source: 'facebook_ads', status: 'setting_planifie', tags: ['chaud', 'referral'], call_attempts: 1, reached: true },
    { first_name: 'Camille', last_name: 'Laurent', phone: '06 90 12 34 56', email: 'camille.l@icloud.com', source: 'instagram_ads', status: 'dead', tags: ['froid'], call_attempts: 5, reached: false },
    { first_name: 'Maxime', last_name: 'Garcia', phone: '07 01 23 45 67', email: 'maxime.g@gmail.com', source: 'facebook_ads', status: 'no_show_closing', tags: [], call_attempts: 3, reached: true },
    { first_name: 'Julie', last_name: 'Petit', phone: '07 12 34 56 78', email: 'julie.p@hotmail.com', source: 'manuel', status: 'nouveau', tags: ['chaud'], call_attempts: 0, reached: false },
    { first_name: 'Antoine', last_name: 'Roux', phone: '07 23 45 67 89', email: 'antoine.r@gmail.com', source: 'formulaire', status: 'closing_planifie', tags: ['VIP'], call_attempts: 2, reached: true },
  ]

  const { data: insertedLeads, error: leadsErr } = await supabase
    .from('leads')
    .insert(leads.map((l) => ({ ...l, workspace_id: workspaceId, notes: null })))
    .select()

  if (leadsErr) { console.log('Error inserting leads:', leadsErr.message); return }
  console.log(`✅ ${insertedLeads.length} leads created`)

  // 3. Create calls for some leads
  const now = new Date()
  const calls = [
    // Upcoming calls
    { lead: 'Sophie', type: 'closing', days: 1, hour: 14 },
    { lead: 'Hugo', type: 'closing', days: 1, hour: 16 },
    { lead: 'Antoine', type: 'closing', days: 2, hour: 10 },
    { lead: 'Thomas', type: 'setting', days: 0, hour: 17 },
    // Overdue calls (in the past, still pending)
    { lead: 'Nathan', type: 'setting', days: -1, hour: 15 },
    { lead: 'Marie', type: 'setting', days: -2, hour: 11 },
    // Done calls
    { lead: 'Lucas', type: 'closing', days: -5, hour: 14, outcome: 'done' as const, reached: true, duration: 1800 },
    { lead: 'Lucas', type: 'setting', days: -10, hour: 10, outcome: 'done' as const, reached: true, duration: 900 },
    // No-show
    { lead: 'Emma', type: 'setting', days: -3, hour: 16, outcome: 'no_show' as const },
    { lead: 'Maxime', type: 'closing', days: -4, hour: 11, outcome: 'no_show' as const },
    // Cancelled
    { lead: 'Camille', type: 'setting', days: -7, hour: 9, outcome: 'cancelled' as const },
  ]

  const callInserts = calls.map((c, i) => {
    const lead = insertedLeads.find((l) => l.first_name === c.lead)
    if (!lead) return null
    const date = new Date(now)
    date.setDate(date.getDate() + (c.days ?? 0))
    date.setHours(c.hour ?? 14, 0, 0, 0)
    return {
      workspace_id: workspaceId,
      lead_id: lead.id,
      type: c.type,
      scheduled_at: date.toISOString(),
      outcome: c.outcome ?? 'pending',
      attempt_number: i + 1,
      reached: c.reached ?? false,
      duration_seconds: c.duration ?? null,
      notes: null,
      closer_id: null,
    }
  }).filter(Boolean)

  const { data: insertedCalls, error: callsErr } = await supabase
    .from('calls')
    .insert(callInserts)
    .select()

  if (callsErr) { console.log('Error inserting calls:', callsErr.message); return }
  console.log(`✅ ${insertedCalls.length} calls created`)

  // 4. Create follow-ups for some leads
  const followUps = [
    { lead: 'Marie', reason: 'Relance après no-show', days: 1, channel: 'whatsapp', status: 'en_attente' },
    { lead: 'Emma', reason: 'Rappel RDV', days: 0, channel: 'email', status: 'en_attente' },
    { lead: 'Julie', reason: 'Premier contact', days: 2, channel: 'manuel', status: 'en_attente' },
    { lead: 'Lucas', reason: 'Suivi post-closing', days: -3, channel: 'whatsapp', status: 'fait' },
  ]

  const fuInserts = followUps.map((f) => {
    const lead = insertedLeads.find((l) => l.first_name === f.lead)
    if (!lead) return null
    const date = new Date(now)
    date.setDate(date.getDate() + f.days)
    date.setHours(9, 0, 0, 0)
    return {
      workspace_id: workspaceId,
      lead_id: lead.id,
      reason: f.reason,
      scheduled_at: date.toISOString(),
      channel: f.channel,
      status: f.status,
      notes: null,
    }
  }).filter(Boolean)

  const { data: insertedFU, error: fuErr } = await supabase
    .from('follow_ups')
    .insert(fuInserts)
    .select()

  if (fuErr) { console.log('Error inserting follow-ups:', fuErr.message); return }
  console.log(`✅ ${insertedFU.length} follow-ups created`)

  console.log('\n🎉 Seed complete!')
}

seed()
