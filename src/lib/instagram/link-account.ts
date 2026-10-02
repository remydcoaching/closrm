// Links (or re-links) the workspace's Instagram professional account from
// the Meta integration's tokens into ig_accounts — the row every Instagram
// feature reads (sync, DMs, comments, publishing).
//
// Called by POST /api/instagram/account (first setup, with the coach's
// starting figures) and right after a Meta (re)connection, so fresh tokens
// replace dead ones everywhere. The coach's starting figures are kept on a
// re-link: they are the baseline of their progress charts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isInvalidTokenPayload } from '@/lib/meta/token-error'

/** Columns of ig_accounts safe to send to a client — never the Meta access tokens. */
export const IG_ACCOUNT_PUBLIC_COLS =
  'id, workspace_id, ig_user_id, ig_username, page_id, is_connected, token_expires_at, starting_followers, starting_date, starting_monthly_views, starting_engagement, starting_best_reel, created_at'

const GRAPH = 'https://graph.facebook.com/v25.0'

export interface LinkInput {
  userAccessToken: string
  tokenExpiresAt: string | null
  pageId: string
  /** Page token stored at connection time, used if /me/accounts doesn't return the page. */
  fallbackPageAccessToken: string | null
}

export interface Baseline {
  starting_followers: number
  starting_date: string
  starting_monthly_views: number
  starting_engagement: number
  starting_best_reel: number
}

export type LinkResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }

/**
 * Pure: the baseline to store. Explicit values from the coach win; otherwise
 * an existing row keeps its own; a brand-new row starts from today's figures.
 */
export function baselineFor(existing: Partial<Baseline> | null, requested: Partial<Baseline>, followersNow: number, today: string): Baseline {
  const pick = <K extends keyof Baseline>(k: K, fresh: Baseline[K]): Baseline[K] => (requested[k] ?? existing?.[k] ?? fresh) as Baseline[K]
  return {
    starting_followers: pick('starting_followers', followersNow),
    starting_date: pick('starting_date', today),
    starting_monthly_views: pick('starting_monthly_views', 0),
    starting_engagement: pick('starting_engagement', 0),
    starting_best_reel: pick('starting_best_reel', 0),
  }
}

async function graph(path: string, token: string): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`)
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, json }
}

const EXPIRED: LinkResult = { ok: false, status: 401, error: 'Session Meta expirée ou révoquée. Reconnectez Meta dans Paramètres › Intégrations.' }

export async function linkInstagramAccount(
  supabase: SupabaseClient,
  workspaceId: string,
  input: LinkInput,
  requested: Partial<Baseline> = {},
): Promise<LinkResult> {
  // Page token (publishing + DMs): fresh from /me/accounts, else the stored one.
  const pages = await graph('me/accounts?fields=id,access_token', input.userAccessToken)
  if (!pages.ok && isInvalidTokenPayload(pages.json)) return EXPIRED
  const list = Array.isArray(pages.json.data) ? (pages.json.data as { id: string; access_token?: string }[]) : []
  const pageAccessToken = list.find((p) => p.id === input.pageId)?.access_token ?? input.fallbackPageAccessToken

  const page = await graph(`${input.pageId}?fields=instagram_business_account`, input.userAccessToken)
  if (!page.ok) return isInvalidTokenPayload(page.json) ? EXPIRED : { ok: false, status: 400, error: 'Impossible de récupérer le compte Instagram lié à la Page' }
  const igUserId = (page.json.instagram_business_account as { id?: string } | undefined)?.id
  if (!igUserId) {
    return {
      ok: false,
      status: 400,
      error: 'Aucun compte Instagram professionnel lié à votre Page Facebook. Liez votre compte Instagram à votre Page dans les paramètres Facebook.',
    }
  }

  const profile = await graph(`${igUserId}?fields=username,name,followers_count`, input.userAccessToken)
  if (!profile.ok) return isInvalidTokenPayload(profile.json) ? EXPIRED : { ok: false, status: 400, error: 'Impossible de récupérer le profil Instagram' }

  const { data: existing } = await supabase
    .from('ig_accounts')
    .select('starting_followers, starting_date, starting_monthly_views, starting_engagement, starting_best_reel')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const baseline = baselineFor(existing as Partial<Baseline> | null, requested, Number(profile.json.followers_count ?? 0), new Date().toISOString().slice(0, 10))
  const { data, error } = await supabase
    .from('ig_accounts')
    .upsert(
      {
        workspace_id: workspaceId,
        ig_user_id: igUserId,
        ig_username: (profile.json.username ?? profile.json.name ?? null) as string | null,
        access_token: input.userAccessToken,
        token_expires_at: input.tokenExpiresAt,
        page_id: input.pageId,
        page_access_token: pageAccessToken,
        is_connected: true,
        ...baseline,
      },
      { onConflict: 'workspace_id' },
    )
    .select(IG_ACCOUNT_PUBLIC_COLS)
    .single()
  if (error) return { ok: false, status: 500, error: error.message }
  return { ok: true, data: data as Record<string, unknown> }
}
