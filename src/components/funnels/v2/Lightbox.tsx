'use client'

/**
 * T-028a — Composant Lightbox réutilisable (E6, effet forcé).
 *
 * Affiche une image en plein écran sur fond noir 92%. Fermeture :
 * - clic sur le backdrop
 * - clic sur le bouton ×
 * - touche Échap
 *
 * Le composant est non-contrôlé : il s'auto-gère via une div trigger
 * (`<LightboxTrigger />`) ou peut être piloté en mode contrôlé via la prop `imageUrl`.
 *
 * Convention : on rend le modal directement (pas de portal pour rester simple en V1).
 * Si on a besoin de portal pour passer au-dessus de modals existants en T-028b,
 * on basculera sur `createPortal(...)`.
 */

import { useEffect, useState } from 'react'

interface LightboxProps {
  /** URL de l'image à afficher. Si null/undefined, le lightbox est fermé. */
  imageUrl: string | null
  /** Texte alternatif de l'image. */
  alt?: string
  /** Callback de fermeture. */
  onClose: () => void
}

export function Lightbox({ imageUrl, alt = '', onClose }: LightboxProps) {
  // Fermeture via touche Échap + lock du scroll body quand le lightbox est ouvert
  useEffect(() => {
    if (!imageUrl) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [imageUrl, onClose])

  if (!imageUrl) return null

  return (
    <div
      className="fnl-lightbox-overlay"
      onClick={(e) => {
        // Ferme uniquement si clic sur le backdrop, pas sur l'image elle-même
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'image"
    >
      <button
        type="button"
        className="fnl-lightbox-close"
        onClick={onClose}
        aria-label="Fermer l'aperçu"
      >
        ×
      </button>
      <div className="fnl-lightbox-content">
        {/* Image native HTML — pas de next/image car les funnels publics
            consomment des URL externes (uploads coachs) qu'on ne configure pas dans next.config */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} />
      </div>
    </div>
  )
}

/**
 * Hook utilitaire pour gérer l'état du lightbox de manière compacte.
 *
 * Usage :
 *   const lightbox = useLightbox()
 *   <div className="fnl-lightbox-trigger" onClick={() => lightbox.open('/path/img.jpg')}>...</div>
 *   <Lightbox imageUrl={lightbox.imageUrl} onClose={lightbox.close} />
 */
export function useLightbox() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  return {
    imageUrl,
    open: (url: string) => setImageUrl(url),
    close: () => setImageUrl(null),
  }
}
