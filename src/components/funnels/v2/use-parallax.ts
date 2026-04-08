'use client'

/**
 * T-028a — Hook useParallax (E13, toggleable OFF par défaut).
 *
 * Met à jour la CSS var `--fnl-parallax-y` sur l'élément cible en fonction
 * du scroll de la page. Le CSS de e13-parallax.css consomme cette var pour
 * translater les pseudos `::before` et `::after` du hero (les cercles glow).
 *
 * Optimisé via `requestAnimationFrame` pour ne pas spammer les writes DOM
 * pendant le scroll.
 *
 * Désactivé automatiquement si :
 * - `enabled = false`
 * - viewport mobile (<768px)
 * - prefers-reduced-motion: reduce
 */

import { useEffect, useRef } from 'react'

interface UseParallaxOptions {
  enabled?: boolean
  /** Intensité du parallax. Défaut : 0.3 (30% de la distance de scroll) */
  intensity?: number
}

export function useParallax<T extends HTMLElement = HTMLElement>(
  options: UseParallaxOptions = {}
) {
  const { enabled = true, intensity = 0.3 } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled) {
      // Reset la var au cas où l'effet vient d'être désactivé
      if (ref.current) {
        ref.current.style.setProperty('--fnl-parallax-y', '0px')
      }
      return
    }

    // Skip si mobile ou reduced-motion
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 768px)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const el = ref.current
    if (!el) return

    let rafId = 0
    let pending = false

    const update = () => {
      pending = false
      const rect = el.getBoundingClientRect()
      // Distance entre le top du viewport et le top de l'élément
      // Quand l'élément est au-dessus du viewport, l'offset diminue → translation négative
      const offset = -rect.top * intensity
      el.style.setProperty('--fnl-parallax-y', `${offset}px`)
    }

    const onScroll = () => {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(update)
    }

    update() // sync initial
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [enabled, intensity])

  return ref
}
