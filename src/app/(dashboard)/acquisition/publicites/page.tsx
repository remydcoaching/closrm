import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import type { MetaCredentials } from '@/lib/meta/client'
import PublicitesClient from './publicites-client'

export type MetaConnectionState = 'not_connected' | 'needs_upgrade' | 'connected'

export default async function PublicitesPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials_encrypted, is_active')
    .eq('workspace_id', workspaceId)
    .eq('type', 'meta')
    .eq('is_active', true)
    .maybeSingle()

  let connectionState: MetaConnectionState = 'not_connected'

  if (integration?.credentials_encrypted) {
    try {
      const credentials: MetaCredentials = JSON.parse(
        decrypt(integration.credentials_encrypted)
      )
      connectionState = credentials.ad_account_id ? 'connected' : 'needs_upgrade'
    } catch {
      connectionState = 'not_connected'
    }
  }

  return <PublicitesClient connectionState={connectionState} />
}
