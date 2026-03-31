import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import { unsubscribePageFromLeadgen, type MetaCredentials } from '@/lib/meta/client'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch existing integration to get credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, meta_page_id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .maybeSingle()

    // Best-effort unsubscribe the page
    if (integration?.credentials_encrypted && integration?.meta_page_id) {
      try {
        const creds: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))
        await unsubscribePageFromLeadgen(creds.page_id, creds.page_access_token)
      } catch {
        // Ignore — page may already be unsubscribed or token expired
      }
    }

    // Deactivate integration in DB
    const { error } = await supabase
      .from('integrations')
      .update({
        is_active: false,
        credentials_encrypted: null,
        meta_page_id: null,
        connected_at: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')

    if (error) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
