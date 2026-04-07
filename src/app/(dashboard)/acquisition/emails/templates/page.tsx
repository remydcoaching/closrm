import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import TemplatesClient from './templates-client'

export default async function TemplatesPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  return <TemplatesClient initialTemplates={data ?? []} />
}
