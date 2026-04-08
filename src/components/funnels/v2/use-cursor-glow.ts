'use client'

/**
 * T-028a — Hook useCursorGlow (E14, toggleable OFF par défaut).
 *
 * Met à jour les CSS vars `--fnl-cursor-x` et `--fnl-cursor-y` sur l'élément
 * cible en fonction de la position du curseur. Le CSS de e14-cursor-glow.css
 * consomme ces vars pour positionner un radial-gradient teinté en pseudo `::after`.
 *
 * Désactivé automatiquement si :
 * - `enabled = false`
 * - device sans hover (mobile, tactile)
 * - prefers-reduced-motion: reduce
 *
 * Le hook attache aussi la classe `.fnl-cursor-glow-target` sur l'élément
 * pour que le CSS puisse le cibler.
 */

import { useEffect, useRef } from 'react'

interface UseCursorGlowOptions {
  enabled?: boolean
}

export function useCursorGlow<T extends HTMLElement = HTMLElement>(
  options: UseCursorGlowOptions = {}
) {
  const { enabled = true } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!enabled) {
      el.classList.remove('fnl-cursor-glow-target')
      return
    }

    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    el.classList.add('fnl-cursor-glow-target')

    let rafId = 0
    let pendingX = 0
    let pendingY = 0
    let pending = false

    const apply = () => {
      pending = false
      el.style.setProperty('--fnl-cursor-x', `${pendingX}px`)
      el.style.setProperty('--fnl-cursor-y', `${pendingY}px`)
    }

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      pendingX = e.clientX - rect.left
      pendingY = e.clientY - rect.top
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(apply)
    }

    el.addEventListener('mousemove', onMove)

    return () => {
      el.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
      el.classList.remove('fnl-cursor-glow-target')
    }
  }, [enabled])

  return ref
}
