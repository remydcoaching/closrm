import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import AutomationsClient from './automations-client'

export default async function AutomationsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data } = await supabase
    .from('workflows')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  return <AutomationsClient initialWorkflows={data ?? []} />
}
