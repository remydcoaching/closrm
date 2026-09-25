// source_post_url (and any other externally-sourced URL string) is free
// text from instagram_interactions, populated by Hiker/Apify — never
// guaranteed to be a real http(s) URL. Validate the scheme before rendering
// it in an href to avoid a javascript:/data: URL being clickable (XSS via a
// manipulated or malformed stored value).
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}
