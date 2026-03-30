import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/crypto'

export async function getIntegrationCredentials(
  workspaceId: string,
  type: string
): Promise<Record<string, string> | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('integrations')
    .select('credentials_encrypted, is_active')
    .eq('workspace_id', workspaceId)
    .eq('type', type)
    .single()

  if (!data || !data.is_active || !data.credentials_encrypted) return null

  try {
    const decrypted = decrypt(data.credentials_encrypted)
    return JSON.parse(decrypted)
  } catch {
    return null
  }
}
