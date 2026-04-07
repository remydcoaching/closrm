import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import BroadcastsClient from './broadcasts-client'

export default async function BroadcastsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data } = await supabase
    .from('email_broadcasts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return <BroadcastsClient initialBroadcasts={data ?? []} />
}
