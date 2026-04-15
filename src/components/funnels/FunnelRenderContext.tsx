'use client'

/**
 * A-028a-01/02 — Contexte de rendu des blocs de funnel.
 *
 * Permet aux blocs interactifs (BookingBlock, FormBlock) de savoir s'ils sont
 * dans le builder (preview) ou dans la page publique, sans modifier les props
 * de tous les composants intermédiaires.
 *
 * Usage :
 * - Page publique : <FunnelRenderProvider isPreview={false} funnelPageId={page.id}>
 * - Builder preview : pas de provider → defaults (isPreview: true, funnelPageId: null)
 */

import { createContext, useContext } from 'react'

interface FunnelRenderContextValue {
  /** true dans le builder, false sur la page publique. */
  isPreview: boolean
  /** ID de la page de funnel (disponible uniquement côté public). */
  funnelPageId: string | null
}

const FunnelRenderContext = createContext<FunnelRenderContextValue>({
  isPreview: true,
  funnelPageId: null,
})

export function FunnelRenderProvider({
  isPreview,
  funnelPageId,
  children,
}: FunnelRenderContextValue & { children: React.ReactNode }) {
  return (
    <FunnelRenderContext.Provider value={{ isPreview, funnelPageId }}>
      {children}
    </FunnelRenderContext.Provider>
  )
}

export function useFunnelRender() {
  return useContext(FunnelRenderContext)
}
