'use client'

/**
 * T-028a — Composant CountUp (E7, toggleable ON par défaut).
 *
 * Affiche un nombre qui s'anime de 0 à `target` quand l'élément entre dans
 * le viewport. L'animation utilise `requestAnimationFrame` + un easing
 * cubic-out, et n'est jouée qu'une seule fois par cycle "enabled".
 *
 * Comportement selon `enabled` :
 * - `enabled = false` → affiche directement `target`, pas d'animation
 * - `enabled = true`  → animation déclenchée à l'entrée dans le viewport
 * - Toggle false → true → restart depuis 0
 * - Toggle true → false → snap immédiat sur target
 *
 * Le label visuel et la couleur viennent du CSS `.fnl-count-up`
 * (cf. src/styles/funnels/effects/e7-count-up.css).
 */

import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  target: number
  /** Durée de l'animation en ms. Défaut : 1500 */
  duration?: number
  /** Active/désactive l'animation. Défaut : true */
  enabled?: boolean
  /** Préfixe affiché avant le nombre (ex: "+" pour "+150") */
  prefix?: string
  /** Suffixe affiché après le nombre (ex: " clients") */
  suffix?: string
  /** Classe CSS additionnelle pour personnaliser le style */
  className?: string
}

export function CountUp({
  target,
  duration = 1500,
  enabled = true,
  prefix = '',
  suffix = '',
  className = 'fnl-count-up',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  // `animValue` = valeur en cours d'animation (0 → target). Utilisée uniquement quand enabled=true.
  // Quand enabled=false, on dérive directement `displayValue = target` sans setState dans l'effect
  // (évite le pattern interdit par la règle react-hooks/set-state-in-effect).
  const [animValue, setAnimValue] = useState<number>(0)
  const displayValue = enabled ? animValue : target

  useEffect(() => {
    if (!enabled) return

    const el = ref.current
    if (!el) return

    let rafId = 0
    let stopped = false

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((e) => e.isIntersecting)
        if (!intersecting || stopped) return

        // Reset à 0 puis animation — appelé depuis un callback async (IntersectionObserver),
        // pas depuis le body de l'effect, donc le pattern est OK pour la règle React.
        setAnimValue(0)
        const startTime = performance.now()
        const animate = (now: number) => {
          if (stopped) return
          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          // Easing cubic-out (rapide au début, lent à la fin)
          const eased = 1 - Math.pow(1 - progress, 3)
          setAnimValue(Math.round(target * eased))
          if (progress < 1) {
            rafId = requestAnimationFrame(animate)
          }
        }
        rafId = requestAnimationFrame(animate)
        // Une seule animation par cycle enabled
        observer.disconnect()
      },
      { threshold: 0.3 }
    )

    observer.observe(el)

    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [target, duration, enabled])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue.toLocaleString('fr-FR')}
      {suffix}
    </span>
  )
}
