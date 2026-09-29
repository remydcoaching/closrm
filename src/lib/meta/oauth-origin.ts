// Which ClosRM address a Meta login returns to.
//
// ClosRM answers on several addresses (closrm.fr, closrm.vercel.app, …) and
// the browser keeps a separate session per address. The Meta login used to
// always return to NEXT_PUBLIC_APP_URL: a coach connected on closrm.fr came
// back on closrm.vercel.app without their session and landed on the login
// page — the connection never completed (tokens stayed dead for months).
// Now the login returns to the address it was started from, as long as that
// address is a known ClosRM address (never an arbitrary Host header).
// Every address listed here must also be a "Valid OAuth Redirect URI" in the
// Meta app (…/api/integrations/meta/callback).

const KNOWN_ORIGINS = ['https://closrm.fr', 'https://www.closrm.fr', 'https://closrm.vercel.app']

function originOf(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Origins a Meta login may return to: NEXT_PUBLIC_APP_URL, APP_ORIGINS (comma-separated) and the production domains. */
export function allowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const list = [
    originOf(env.NEXT_PUBLIC_APP_URL),
    ...(env.APP_ORIGINS ?? '').split(',').map((s) => originOf(s.trim())),
    ...KNOWN_ORIGINS,
  ]
  if (env.NODE_ENV !== 'production') list.push('http://localhost:3000')
  return [...new Set(list.filter((o): o is string => !!o))]
}

/** The request's origin when it is a known ClosRM address, NEXT_PUBLIC_APP_URL otherwise. */
export function resolveAppOrigin(requestOrigin: string | null | undefined, env: NodeJS.ProcessEnv = process.env): string {
  const req = originOf(requestOrigin)
  const allowed = allowedOrigins(env)
  if (req && allowed.includes(req)) return req
  const fallback = originOf(env.NEXT_PUBLIC_APP_URL)
  if (!fallback) throw new Error('NEXT_PUBLIC_APP_URL not set')
  return fallback
}

export const metaCallbackUrl = (origin: string) => `${origin}/api/integrations/meta/callback`
export const integrationsUrl = (origin: string) => `${origin}/parametres/integrations`

/** Cookie holding the exact redirect_uri of this login: the code exchange must send the same one. */
export const META_REDIRECT_COOKIE = 'meta_oauth_redirect'
