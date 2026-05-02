'use client'

/**
 * EventCard — affichage Notion Cal style :
 *   fill 10% opacity color + barre gauche 3px full opacity.
 *
 * Layout adaptatif : single-line si durée ≤ 30min (titre + heure côte à côte
 * avec ellipsis), multi-line sinon (titre / heure / sub).
 *
 * Read-only Phase 3a — onClick reçu mais usage limité (pas de side panel
 * encore). Phase 3b ajoutera l'ouverture du EventDetailPanel.
 */

import type { CSSProperties } from 'react'
import { addMinutes, parseISO } from 'date-fns'
import type { AgendaEvent } from '@/types/agenda'
import { isoToHHmm } from '@/lib/agenda/positioning'
import { Z_AGENDA } from '@/lib/agenda/z-index'

interface EventCardProps {
  event: AgendaEvent
  onClick?: (event: AgendaEvent) => void
  /** Position absolue calculée par le parent (top, height, left, width) */
  style: CSSProperties
}

export function EventCard({ event, onClick, style }: EventCardProps) {
  const isShort = event.durationMinutes <= 30
  const start = isoToHHmm(event.start)
  const end = isoToHHmm(addMinutes(parseISO(event.start), event.durationMinutes).toISOString())
  const fillBg = `color-mix(in srgb, ${event.color} calc(var(--agenda-event-fill-opacity) * 100%), transparent)`

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(event)
      }}
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        background: fillBg,
        borderLeft: `var(--agenda-event-bar-width) solid ${event.color}`,
        border: 'none',
        borderRadius: 'var(--agenda-event-radius)',
        padding: isShort ? '2px 6px' : '4px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: Z_AGENDA.eventBlock,
        transition: 'opacity 0.1s',
        display: 'flex',
        flexDirection: isShort ? 'row' : 'column',
        alignItems: isShort ? 'center' : 'flex-start',
        gap: isShort ? 6 : 0,
        minWidth: 0,
        textAlign: 'left',
        ...style,
        // Re-applique borderLeft après le spread style pour éviter qu'un parent
        // surcharge avec un border-left générique
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--agenda-event-bar-width)',
        borderLeftColor: event.color,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {isShort ? (
        <>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {start}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {event.title}
          </span>
        </>
      ) : (
        <>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              lineHeight: 1.2,
            }}
          >
            {event.title}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {start} — {end}
          </span>
          {event.subtitle && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              {event.subtitle}
            </span>
          )}
        </>
      )}
    </button>
  )
}
