'use client'

/**
 * T-028a — Composant BeforeAfter (E11, toggleable OFF par défaut).
 *
 * Slider draggable qui révèle l'image "après" par-dessus l'image "avant".
 * L'utilisateur drag horizontalement (souris ou tactile) pour révéler plus
 * ou moins de l'image après.
 *
 * Le styling est entièrement géré par CSS via la CSS var `--ba-position`
 * (cf. src/styles/funnels/effects/e11-before-after.css). Ce composant ne fait
 * que mettre à jour cette var en réponse aux events souris/touch.
 *
 * Si l'effet n'est pas activé sur le `.fnl-root` parent (classe
 * `.fx-e11-before-after` absente), le composant est caché via `display: none`
 * dans le CSS.
 */

import { useCallback, useRef, useState } from 'react'

interface BeforeAfterProps {
  beforeUrl: string
  afterUrl: string
  beforeLabel?: string
  afterLabel?: string
  /** Position initiale du slider en pourcentage (0-100). Défaut : 50 */
  initialPosition?: number
}

export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Avant',
  afterLabel = 'Après',
  initialPosition = 50,
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<number>(initialPosition)
  const [dragging, setDragging] = useState<boolean>(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relativeX = clientX - rect.left
    const percent = Math.max(0, Math.min(100, (relativeX / rect.width) * 100))
    setPosition(percent)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true)
    updateFromClientX(e.clientX)
    // Capture le pointer pour continuer à recevoir les events même si on sort du container
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    updateFromClientX(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      ref={containerRef}
      className="fnl-before-after"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ '--ba-position': `${position}%` } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="fnl-ba-img-before"
        src={beforeUrl}
        alt={beforeLabel}
        draggable={false}
      />
      <div
        className="fnl-ba-overlay"
        style={{ '--ba-position': `${position}%` } as React.CSSProperties}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="fnl-ba-img-after"
          src={afterUrl}
          alt={afterLabel}
          draggable={false}
        />
      </div>
      <div className="fnl-ba-handle" />
      <span className="fnl-ba-label fnl-ba-label-before">{beforeLabel}</span>
      <span className="fnl-ba-label fnl-ba-label-after">{afterLabel}</span>
    </div>
  )
}
