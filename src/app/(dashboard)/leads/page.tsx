import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import LeadsClient from './leads-client'

export default async function LeadsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <LeadsClient initialLeads={data ?? []} initialTotal={count ?? 0} />
}
