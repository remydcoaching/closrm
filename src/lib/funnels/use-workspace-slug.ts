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

/**
 * T-028 Phase 14/16 — Hook qui fetch le slug du workspace courant.
 *
 * Distingue 3 états pour permettre une UX propre :
 * - `slug = null` + `fetched = false` : fetch en cours (loader ou cache UI)
 * - `slug = null` + `fetched = true`  : workspace sans slug configuré
 *   → on doit afficher un warning avec un CTA vers /parametres/reglages
 * - `slug = "xxx"` + `fetched = true` : OK, on peut construire les URLs
 *
 * Ancien comportement (`useWorkspaceSlug(): string | null`) préservé pour
 * les callers qui n'ont pas besoin de distinguer les 2 cas null.
 */

interface WorkspaceSlugState {
  slug: string | null
  fetched: boolean
}

export function useWorkspaceSlugState(): WorkspaceSlugState {
  const [state, setState] = useState<WorkspaceSlugState>({ slug: null, fetched: false })

  useEffect(() => {
    let cancelled = false
    fetch('/api/workspaces/slug')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        const slug = json && typeof json.slug === 'string' ? json.slug : null
        setState({ slug, fetched: true })
      })
      .catch(() => {
        if (cancelled) return
        // silent fail — on marque comme fetched pour ne pas afficher un loader infini,
        // mais le slug reste null et les composants afficheront un warning
        setState({ slug: null, fetched: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * Version compatibilité — retourne juste le slug (ou null). Pour les callers
 * qui n'ont pas besoin de différencier "en cours de chargement" vs "pas de slug".
 */
export function useWorkspaceSlug(): string | null {
  return useWorkspaceSlugState().slug
}

/**
 * Construit l'URL publique complète d'une page de funnel à partir des slugs.
 * Retourne `null` si un des slugs manque (workspace non configuré, funnel
 * sans page, etc.).
 *
 * Utilise `NEXT_PUBLIC_APP_URL` (défini dans .env.local et dans les env vars
 * Vercel) comme base URL. En dev = `http://localhost:3000`, en prod =
 * `https://closrm.vercel.app`. Fallback sur `window.location.origin` si la
 * variable d'env n'est pas définie.
 */
export function buildPublicFunnelUrl(
  workspaceSlug: string | null,
  funnelSlug: string | null,
  pageSlug: string | null,
): string | null {
  if (!workspaceSlug || !funnelSlug || !pageSlug) return null
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin}/f/${workspaceSlug}/${funnelSlug}/${pageSlug}`
}
