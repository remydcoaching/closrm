import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/meta/encryption'
import type { MetaCredentials } from '@/lib/meta/client'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const body = await request.json()
    const newAdAccountId = body.ad_account_id as string

    if (!newAdAccountId) {
      return NextResponse.json({ error: 'ad_account_id requis' }, { status: 400 })
    }

    // Fetch current integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Integration Meta non trouvee' }, { status: 404 })
    }

    // Decrypt, update ad_account_id, re-encrypt
    const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))
    credentials.ad_account_id = newAdAccountId
    const encrypted = encrypt(JSON.stringify(credentials))

    await supabase
      .from('integrations')
      .update({ credentials_encrypted: encrypted })
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')

    return NextResponse.json({ data: { ad_account_id: newAdAccountId } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
