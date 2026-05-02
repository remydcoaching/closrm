'use client'

/**
 * Ligne horizontale 2px traversant la colonne du jour courant + point rouge
 * dans la gutter horaires. Update toutes les 60s via setInterval pour suivre
 * "now" sans framer-motion.
 *
 * `top` est calculé via `nowIndicatorTop()` côté parent et passé en prop —
 * permet au parent de re-render cohéremment avec la grille.
 */

import { useEffect, useState } from 'react'
import { Z_AGENDA } from '@/lib/agenda/z-index'
import { nowIndicatorTop, DEFAULT_GEOMETRY, type GridGeometry } from '@/lib/agenda/positioning'

interface NowIndicatorProps {
  /** Géométrie utilisée par la grille (cohérence top). */
  geometry?: GridGeometry
  /** Si true, étend la ligne sur toute la largeur (vue jour). Sinon, juste la
   *  colonne courante (vue semaine — le parent positionne via `left`/`width`). */
  fullWidth?: boolean
  /** Largeur de la gutter horaires (défaut 56px). Le point rouge est centré
   *  à `gutterWidth - 4` (rayon 4) pour déborder légèrement dans la grille. */
  gutterWidth?: number
}

export function NowIndicator({
  geometry = DEFAULT_GEOMETRY,
  fullWidth = false,
  gutterWidth = 56,
}: NowIndicatorProps) {
  // Init null pour éviter un hydration mismatch (le top dépend de Date.now()
  // qui diffère entre le rendu serveur et le rendu client). Une fois monté,
  // on commence à afficher et on tick toutes les 60s.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Defer le premier setNow d'un microtâche pour éviter le warning
    // react-hooks/set-state-in-effect (cascading render au mount). C'est
    // exactement la cascade qu'on veut ici : rendre `null` au SSR/premier
    // paint pour éviter l'hydration mismatch, puis afficher Date.now() au
    // tick suivant.
    const microId = queueMicrotask(() => setNow(new Date()))
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => {
      void microId
      clearInterval(id)
    }
  }, [])

  if (!now) return null
  const top = nowIndicatorTop(now, geometry)
  if (top === null) return null

  return (
    <>
      {/* Point rouge dans la gutter, centré sur la ligne */}
      <div
        style={{
          position: 'absolute',
          top: top - 4,
          left: gutterWidth - 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          zIndex: Z_AGENDA.nowLine,
          pointerEvents: 'none',
        }}
        aria-hidden
      />
      {/* Ligne 2px traversante */}
      <div
        style={{
          position: 'absolute',
          top: top - 1,
          left: fullWidth ? 0 : gutterWidth,
          right: 0,
          height: 'var(--agenda-now-thickness)',
          background: 'var(--color-primary)',
          zIndex: Z_AGENDA.nowLine,
          pointerEvents: 'none',
        }}
        aria-label="Heure actuelle"
      />
    </>
  )
}
