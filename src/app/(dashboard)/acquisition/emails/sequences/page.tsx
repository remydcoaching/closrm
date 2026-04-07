import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import SequencesClient from './sequences-client'

export default async function SequencesPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data } = await supabase
    .from('workflows')
    .select('*, workflow_steps(*)')
    .eq('workspace_id', workspaceId)
    .eq('trigger_config->>sequence', 'true')
    .order('created_at', { ascending: false })

  return <SequencesClient initialSequences={data ?? []} />
}
