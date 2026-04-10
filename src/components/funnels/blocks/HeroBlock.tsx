'use client'

/**
 * T-028c — HeroBlock migré vers le design system v2.
 *
 * C'est le bloc le plus visible d'une page funnel — l'objectif de la migration
 * est de lui faire porter tous les effets premium du design system :
 * - `.fnl-hero` pour que l'effet **E2 hero glow** puisse s'attacher via ::before/::after
 * - `.fnl-hero-inner` pour le content centré max 800px (z-index au-dessus du glow)
 * - `.fnl-headline` (Poppins 800, 26-42px) pour le titre principal
 * - `.fnl-hook` (Poppins 600, 18-22px) pour le sous-titre
 * - `.fnl-btn` pour le CTA (apporte gradient + ombre colorée E4 + shine E3 + hover)
 *
 * Avant : gradient `#1a1a2e → #16213e → #0f3460` codé en dur (assumait dark theme),
 * couleur de bouton `var(--color-primary, #E53E3E)` (palette CRM, pas funnels), pas
 * de Poppins, pas d'animation.
 *
 * Après : tout vient du preset choisi par le coach via `--fnl-*`. Quand le preset
 * change, le hero s'adapte automatiquement (light/dark, couleur, gradient).
 *
 * Note : si une `backgroundImage` est configurée par le coach, on la superpose
 * au fond `--fnl-hero-bg` du preset avec un overlay sombre — l'image gagne mais
 * les couleurs du texte/bouton restent celles du preset pour la cohérence.
 */

import type { HeroBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: HeroBlockConfig
}

export default function HeroBlock({ config }: Props) {
  const hasImage = !!config.backgroundImage

  // Si une image de fond custom est définie, on la superpose au fond du preset
  // avec un overlay noir pour garantir la lisibilité du texte.
  const sectionStyle: React.CSSProperties = hasImage
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${config.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  // Alignement du contenu (left/center/right) — surcharge le text-align par défaut
  // de `.fnl-hero` qui est `center`.
  const innerStyle: React.CSSProperties = {
    textAlign: config.alignment ?? 'center',
    marginLeft: config.alignment === 'right' ? 'auto' : undefined,
    marginRight: config.alignment === 'left' ? 'auto' : undefined,
  }

  // Quand on a une image de fond, le texte doit rester blanc lisible
  // (override les CSS vars de couleur du preset uniquement sur ce hero)
  const overrideTextStyle: React.CSSProperties = hasImage
    ? ({
        '--fnl-text': '#FFFFFF',
        '--fnl-text-secondary': 'rgba(255,255,255,0.9)',
      } as React.CSSProperties)
    : {}

  // T-028 Phase 9 — Badge pulsant (E5 forcé) affiché uniquement si `badgeText` non vide
  const showBadge = config.badgeText && config.badgeText.trim().length > 0

  return (
    <section className="fnl-hero" style={{ ...sectionStyle, ...overrideTextStyle }}>
      <div className="fnl-hero-inner" style={innerStyle}>
        {showBadge && (
          <div className="fnl-badge">
            <span className="fnl-badge-dot"></span>
            <span className="fnl-badge-text">{config.badgeText}</span>
          </div>
        )}
        {/*
          Le titre est wrappé dans une `<span className="fnl-shimmer">` pour que
          l'effet E1 shimmer (activable dans l'inspector via config.effects.shimmer)
          s'applique quand la classe `fx-e1-shimmer` est présente sur le wrapper
          du bloc (ajoutée par FunnelPagePreview via getBlockEffectsClasses).
        */}
        <h1 className="fnl-headline">
          <span className="fnl-shimmer">{config.title || 'Titre principal'}</span>
        </h1>
        {config.subtitle && <p className="fnl-hook">{config.subtitle}</p>}
        {config.ctaText && (
          <a href={resolveFunnelUrl(config.ctaUrl)} className="fnl-btn">
            {config.ctaText}
          </a>
        )}
      </div>
    </section>
  )
}
