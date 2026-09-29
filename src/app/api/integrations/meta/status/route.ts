import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { metaConnectionStatus } from '@/lib/meta/connection-status'

/**
 * Live state of the Meta connection (ClosRM Desktop's Integrations page;
 * the web page computes the same thing server-side): linked Page and
 * Instagram account, and whether Meta still accepts the token.
 */
export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const { data: integration } = await supabase
      .from('integrations')
      .select('is_active, connected_at, credentials_encrypted')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .maybeSingle()
    if (!integration?.is_active) {
      return NextResponse.json({ data: { connected: false, connectedAt: null, pageName: null, igUsername: null, needsReconnect: false } })
    }
    const status = await metaConnectionStatus(supabase, workspaceId, integration.credentials_encrypted ?? null)
    return NextResponse.json({ data: { connected: true, connectedAt: integration.connected_at, ...status } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
