// Live state of the workspace's Meta connection, for Settings › Integrations:
// which Page and Instagram account are linked, and whether Meta still
// accepts the token. One Graph call, server-side only — tokens never reach
// the browser.
import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/meta/encryption'
import { isInvalidTokenPayload } from '@/lib/meta/token-error'

export interface MetaConnectionStatus {
  pageName: string | null
  igUsername: string | null
  /** Meta refuses the token (expired, revoked, password changed) or the Instagram sync was stopped for it. */
  needsReconnect: boolean
}

export async function metaConnectionStatus(
  supabase: SupabaseClient,
  workspaceId: string,
  credentialsEncrypted: string | null,
): Promise<MetaConnectionStatus> {
  const { data: ig } = await supabase.from('ig_accounts').select('ig_username, is_connected').eq('workspace_id', workspaceId).maybeSingle()
  let pageName: string | null = null
  let tokenDead = false
  if (credentialsEncrypted) {
    try {
      const creds = JSON.parse(decrypt(credentialsEncrypted)) as { user_access_token?: string; page_name?: string }
      pageName = creds.page_name ?? null
      if (creds.user_access_token) {
        const res = await fetch(`https://graph.facebook.com/v25.0/me?fields=id&access_token=${encodeURIComponent(creds.user_access_token)}`, {
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        })
        if (!res.ok) tokenDead = isInvalidTokenPayload(await res.json().catch(() => null))
      }
    } catch {
      // Meta unreachable or credentials unreadable: don't claim it's broken.
    }
  }
  return {
    pageName,
    igUsername: ig?.ig_username ?? null,
    needsReconnect: tokenDead || ig?.is_connected === false,
  }
}
