// Extracted for testability — parses the one-time PKCE authorization code
// out of the closrm://auth-callback deep link URL. Never extracts or logs
// any other sensitive parameter.
export function extractAuthCode(deepLinkUrl: string): string | null {
  try {
    const parsed = new URL(deepLinkUrl)
    return parsed.searchParams.get('code')
  } catch {
    return null
  }
}
