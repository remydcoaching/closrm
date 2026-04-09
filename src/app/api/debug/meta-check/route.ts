import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import { getAdAccounts, type MetaCredentials } from '@/lib/meta/client'

// TEMPORARY DEBUG ROUTE — remove after fixing Meta ads issue
export async function GET() {
  try {
    const supabase = await createClient()

    // Get all meta integrations (no workspace filter for debug)
    const { data: integrations } = await supabase
      .from('integrations')
      .select('workspace_id, credentials_encrypted, is_active, connected_at')
      .eq('type', 'meta')
      .eq('is_active', true)
      .limit(5)

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ error: 'No Meta integrations found' })
    }

    const results = []

    for (const integration of integrations) {
      try {
        const credentials: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

        const info: Record<string, unknown> = {
          workspace_id: integration.workspace_id,
          connected_at: integration.connected_at,
          has_user_token: !!credentials.user_access_token,
          has_page_token: !!credentials.page_access_token,
          page_id: credentials.page_id,
          page_name: credentials.page_name,
          ad_account_id: credentials.ad_account_id || 'MISSING — this is the problem',
          token_expires_at: credentials.token_expires_at,
        }

        // Try fetching ad accounts
        if (credentials.user_access_token) {
          try {
            const adAccounts = await getAdAccounts(credentials.user_access_token)
            info.ad_accounts_found = adAccounts.length
            info.ad_accounts = adAccounts.map(a => ({ id: a.id, name: a.name, status: a.account_status }))
          } catch (e) {
            info.ad_accounts_error = e instanceof Error ? e.message : String(e)
          }
        }

        results.push(info)
      } catch (e) {
        results.push({ workspace_id: integration.workspace_id, decrypt_error: e instanceof Error ? e.message : String(e) })
      }
    }

    return NextResponse.json({ data: results }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
