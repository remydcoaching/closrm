import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import ProcessSettingClient from './process-setting-client'

export default async function ProcessSettingPage() {
  const { workspaceId, role } = await getWorkspaceId()
  const supabase = await createClient()

  const { data } = await supabase
    .from('setting_processes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return <ProcessSettingClient initialProcesses={data ?? []} canManage={role === 'admin'} />
}
