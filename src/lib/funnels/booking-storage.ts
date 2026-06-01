/**
 * Persistance côté visiteur de la dernière réservation faite sur un funnel.
 *
 * Permet au bloc `BookingActionsBlock` (boutons "Ajouter à mon agenda") d'être
 * placé sur **n'importe quelle page** du funnel, y compris une page de
 * remerciement vers laquelle on redirige après le booking. Tant que le
 * visiteur reste sur le même domaine, le `localStorage` est partagé entre
 * pages, donc la donnée écrite par `BookingBlock` est lisible par
 * `BookingActionsBlock` quel que soit l'ordre des pages.
 *
 * Scoping : on stocke 1 entrée par funnel (workspaceSlug:funnelSlug). Si le
 * visiteur visite plusieurs funnels du même hôte, chacun garde sa dernière
 * réservation.
 */

const STORAGE_PREFIX = 'closrm:funnel-booking:'

export interface FunnelBookingSnapshot {
  /** Titre à afficher dans le RDV calendrier ("RDV Coaching" etc). */
  title: string
  startISO: string
  durationMinutes: number
  location: string
  description: string
  /** Lien de gestion (reprogrammer / annuler) — vide si non disponible. */
  manageUrl: string
  /** Timestamp d'écriture (ms). Sert à expirer les vieilles entrées. */
  savedAt: number
}

/**
 * Extrait le scope de funnel depuis le `pathname` courant.
 *
 * Les pages publiques de funnel suivent le pattern
 * `/f/<workspaceSlug>/<funnelSlug>/<pageSlug>`. Si on n'est pas sur une URL de
 * funnel valide, retourne `null` et toute lecture/écriture est ignorée — c'est
 * notamment le cas dans le builder admin où le pathname est `/acquisition/...`.
 */
export function getFunnelScopeFromPathname(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'f' || parts.length < 3) return null
  return `${parts[1]}:${parts[2]}`
}

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`
}

/**
 * Écrit la réservation. Idempotent : appelable plusieurs fois, l'entrée
 * précédente est écrasée (ce qui est voulu — c'est toujours la plus récente
 * qui doit être proposée à l'ajout au calendrier).
 */
export function saveFunnelBooking(
  scope: string,
  snapshot: Omit<FunnelBookingSnapshot, 'savedAt'>,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: FunnelBookingSnapshot = { ...snapshot, savedAt: Date.now() }
    window.localStorage.setItem(storageKey(scope), JSON.stringify(payload))
  } catch {
    // Quota / mode privé / API indisponible — silencieux, la fonctionnalité
    // est non-critique (le bloc montrera juste le warning rouge).
  }
}

/**
 * Lit la réservation. Retourne `null` si rien stocké, si l'entrée est
 * corrompue, ou si la date du RDV est passée depuis plus de 2 jours (au-delà,
 * proposer d'ajouter au calendrier n'a plus de sens).
 */
export function readFunnelBooking(scope: string): FunnelBookingSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FunnelBookingSnapshot
    if (!parsed?.startISO) return null
    const start = new Date(parsed.startISO).getTime()
    if (Number.isNaN(start)) return null
    // RDV passé de plus de 48h → on ne propose plus l'ajout au calendrier.
    if (Date.now() - start > 48 * 3600 * 1000) {
      window.localStorage.removeItem(storageKey(scope))
      return null
    }
    return parsed
  } catch {
    return null
  }
}
