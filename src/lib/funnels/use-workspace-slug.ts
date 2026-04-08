'use client'

/**
 * T-028 Phase 14 — Hook utilitaire qui fetch le slug du workspace courant
 * une seule fois au mount. Utilisé pour construire les URLs publiques de
 * funnels dans le builder topbar et dans les cards de la liste de funnels.
 *
 * Retourne `null` tant que le fetch n'est pas terminé ou s'il échoue.
 * Pas de cache global — chaque composant qui appelle le hook refetch, ce
 * qui est acceptable vu que c'est un endpoint léger (un SELECT sur une
 * petite table indexée) et qu'on évite d'introduire une lib de state
 * management pour ça.
 */

import { useEffect, useState } from 'react'

export function useWorkspaceSlug(): string | null {
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/workspaces/slug')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        if (json && typeof json.slug === 'string') {
          setSlug(json.slug)
        }
      })
      .catch(() => {
        // silent fail — le slug restera null et les composants cacheront les URLs
      })
    return () => {
      cancelled = true
    }
  }, [])

  return slug
}

/**
 * Construit l'URL publique complète d'une page de funnel à partir des slugs.
 * Retourne `null` si un des slugs manque (workspace non configuré, funnel
 * sans page, etc.).
 *
 * Origin : utilise `window.location.origin` au runtime pour que l'URL
 * fonctionne en dev (`http://localhost:3000`) comme en prod (`https://closrm.app`).
 */
export function buildPublicFunnelUrl(
  workspaceSlug: string | null,
  funnelSlug: string | null,
  pageSlug: string | null,
): string | null {
  if (!workspaceSlug || !funnelSlug || !pageSlug) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/f/${workspaceSlug}/${funnelSlug}/${pageSlug}`
}
