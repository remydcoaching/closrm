'use client'

/**
 * T-028c — SpacerBlock migré vers le design system v2.
 *
 * Bloc le plus simple : juste un espace vertical configurable. Pas de classes
 * CSS du design system nécessaires (rien à styler), pas de couleur, pas de
 * texte. La hauteur reste contrôlée par la prop `config.height` (en px).
 *
 * Min/max guards : on borne entre 0 et 500px pour éviter qu'un coach saisisse
 * une valeur absurde qui casserait la mise en page.
 */

import type { SpacerBlockConfig } from '@/types'

interface Props {
  config: SpacerBlockConfig
}

export default function SpacerBlock({ config }: Props) {
  const height = Math.max(0, Math.min(500, config.height ?? 40))
  return <div aria-hidden="true" style={{ height }} />
}
