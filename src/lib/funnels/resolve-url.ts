/**
 * A-028a — Résolution d'URL pour les blocs de funnel.
 *
 * Les configs de blocs peuvent contenir :
 * - "page:{slug}" → lien vers une autre page du même funnel
 * - Une URL complète → utilisée telle quelle
 * - "#" ou "" → ancre/vide
 *
 * Cette fonction résout "page:slug" en URL relative en extrayant
 * le base path du funnel depuis window.location.pathname.
 */

export function resolveFunnelUrl(url: string | null | undefined): string {
  if (!url) return '#'

  if (url.startsWith('page:')) {
    const pageSlug = url.slice(5)
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/')
      // /f/workspaceSlug/funnelSlug/pageSlug → parts = ['', 'f', ws, funnel, page]
      if (parts.length >= 4 && parts[1] === 'f') {
        return `/f/${parts[2]}/${parts[3]}/${pageSlug}`
      }
    }
    return pageSlug
  }

  return url
}
