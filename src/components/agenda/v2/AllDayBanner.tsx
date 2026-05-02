'use client'

/**
 * Bandeau all-day en haut de la grille. Hauteur 24px (un seul rang Phase 3a) —
 * si plusieurs all-day events sur le même jour, on overflow ellipsis. Phase 3b
 * gérera l'expansion manuelle si besoin.
 *
 * Phase 3a : la sélection des all-day events n'est pas encore implémentée
 * (booking.is_all_day n'existe pas dans le schema actuel). Le composant accepte
 * un tableau pour rester futur-proof — actuellement appelé avec [].
 */

import type { AgendaEvent } from '@/types/agenda'

interface AllDayBannerProps {
  /** Events all-day pour la fenêtre visible (1 jour ou 7). Indexés par day idx 0-6 (week) ou simplement liste (day). */
  events: AgendaEvent[]
  columns: number
  gutterWidth?: number
}

export function AllDayBanner({ events, columns, gutterWidth = 56 }: AllDayBannerProps) {
  // Pas d'all-day events → on ne rend rien (évite un bandeau orphelin avec
  // juste un label "Jour" dans la gutter).
  if (events.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${gutterWidth}px repeat(${columns}, 1fr)`,
        height: 'var(--agenda-allday-height)',
        borderBottom: '1px solid var(--agenda-grid-line-strong)',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 8,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Jour
      </div>
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          style={{
            borderLeft: '1px solid var(--agenda-grid-line)',
            padding: '2px 4px',
            overflow: 'hidden',
          }}
        >
          {i === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}
