/**
 * Convert an Instagram numeric media_id to its public shortcode (used in
 * https://www.instagram.com/reel/{shortcode}/ URLs). Pure base-64 mapping
 * over the IG alphabet.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function mediaIdToShortcode(mediaId: string): string {
  if (!mediaId) return ''
  // Some media_ids contain a "_userId" suffix — strip it
  const numeric = mediaId.split('_')[0]
  if (!/^\d+$/.test(numeric)) return mediaId
  let n: bigint
  try { n = BigInt(numeric) } catch { return mediaId }
  const ZERO = BigInt(0)
  const SIX = BigInt(6)
  const MASK = BigInt(63)
  let out = ''
  while (n > ZERO) {
    out = ALPHABET[Number(n & MASK)] + out
    n = n >> SIX
  }
  return out || mediaId
}
