import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import LeadMagnetsClient from './lead-magnets-client'

export default async function LeadMagnetsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: magnets } = await supabase
    .from('lead_magnets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  const { data: stats } = await supabase
    .from('tracked_links')
    .select('lead_magnet_id, clicks_count, lead_id')
    .eq('workspace_id', workspaceId)

  return <LeadMagnetsClient initialMagnets={magnets ?? []} initialStats={stats ?? []} />
}
