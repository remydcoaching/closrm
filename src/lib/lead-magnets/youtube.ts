/**
 * Extrait l'ID de la vidéo YouTube depuis une URL.
 * Supporte : youtube.com/watch?v=XXX, youtu.be/XXX, shorts/XXX, embed/XXX
 */
export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      return isValidId(id) ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v')
      if (v && isValidId(v)) return v

      const parts = u.pathname.split('/').filter(Boolean)
      // /shorts/XXX, /embed/XXX, /live/XXX
      if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
        return isValidId(parts[1]) ? parts[1] : null
      }
    }
    return null
  } catch {
    return null
  }
}

function isValidId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
}

/**
 * Détecte les bots qui scrapent pour générer les aperçus de lien
 * (Facebook, Instagram, Twitter, WhatsApp, Telegram, Slack, Discord, etc.)
 */
export function isLinkPreviewBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('instagram') ||
    ua.includes('twitterbot') ||
    ua.includes('whatsapp') ||
    ua.includes('telegrambot') ||
    ua.includes('slackbot') ||
    ua.includes('discordbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('pinterest') ||
    ua.includes('skypeuripreview') ||
    ua.includes('applebot') ||
    ua.includes('embedly')
  )
}
