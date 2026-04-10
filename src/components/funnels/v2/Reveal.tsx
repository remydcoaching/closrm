'use client'

/**
 * T-028a — Composant Reveal (E8, toggleable ON par défaut).
 *
 * Wrappe un bloc React et lui ajoute un fade-in-up au moment où il entre
 * dans le viewport. La bascule visible/invisible se fait via la classe
 * CSS `.fnl-reveal-visible` ajoutée dynamiquement par ce composant.
 *
 * Comportement selon `enabled` :
 * - `enabled = false` → l'élément est visible immédiatement (pas de transition)
 * - `enabled = true`  → invisible puis fade-in quand il entre dans le viewport
 *
 * Le CSS de la transition est dans src/styles/funnels/effects/e8-reveal-scroll.css.
 * Le composant n'ajoute la classe `.fnl-reveal` que pour que le CSS puisse cibler.
 */

import { useEffect, useRef, useState } from 'react'

interface RevealProps {
  children: React.ReactNode
  /** Active/désactive l'effet. Défaut : true */
  enabled?: boolean
  /** Classe CSS additionnelle (ajoutée à `.fnl-reveal`) */
  className?: string
  /** Délai en ms avant l'apparition (utile pour staggering plusieurs cards) */
  delay?: number
  /** Tag HTML utilisé. Défaut : div */
  as?: 'div' | 'section' | 'article' | 'span'
}

export function Reveal({
  children,
  enabled = true,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  // `revealed` représente uniquement l'état "vu une fois par l'observer".
  // Quand enabled=false, on dérive directement `isVisible = true` sans setState
  // dans l'effect (évite la règle react-hooks/set-state-in-effect).
  const [revealed, setRevealed] = useState<boolean>(false)
  const isVisible = !enabled || revealed

  useEffect(() => {
    if (!enabled) return

    const el = ref.current
    if (!el) return

    // Quand on (ré)active l'effet, on cache via setState (callback async OK).
    // Le pattern est légitime : c'est un reset déclenché par le changement de prop `enabled`.
    setRevealed(false)

    let timeoutId = 0

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          // setState dans un callback async (IntersectionObserver), pas dans le body — OK
          if (delay > 0) {
            timeoutId = window.setTimeout(() => setRevealed(true), delay)
          } else {
            setRevealed(true)
          }
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [enabled, delay])

  const finalClassName = `fnl-reveal ${isVisible ? 'fnl-reveal-visible' : ''} ${className}`.trim()

  return (
    <Tag ref={ref} className={finalClassName}>
      {children}
    </Tag>
  )
}
