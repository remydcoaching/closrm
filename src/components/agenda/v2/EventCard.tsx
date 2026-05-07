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
  /** Sélectionné au 1er clic — affichage avec un ring renforcé. */
  isHighlighted?: boolean
  /** Si true, affiche les poignées de resize haut/bas (uniquement bookings). */
  resizable?: boolean
}

export function EventCard({ event, onClick, style, isHighlighted, resizable }: EventCardProps) {
  const isShort = event.durationMinutes <= 30
  const isMedium = event.durationMinutes > 30 && event.durationMinutes < 60
  const isPending = event.kind === 'booking' && event.booking.status === 'pending'
  const start = isoToHHmm(event.start)
  const end = isoToHHmm(addMinutes(parseISO(event.start), event.durationMinutes).toISOString())
  const fillBg = isPending
    ? `color-mix(in srgb, ${event.color} 10%, var(--bg-elevated))`
    : `color-mix(in srgb, ${event.color} 22%, var(--bg-elevated))`
  const fillBgHover = isPending
    ? `color-mix(in srgb, ${event.color} 18%, var(--bg-elevated))`
    : `color-mix(in srgb, ${event.color} 32%, var(--bg-elevated))`
  const outlineColor = `color-mix(in srgb, ${event.color} 35%, transparent)`
  const timeColor = `color-mix(in srgb, ${event.color} 30%, var(--text-secondary) 70%)`

  return (
    <button
      type="button"
      data-agenda-event={event.id}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(event)
      }}
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        background: fillBg,
        border: 'none',
        borderRadius: 'var(--agenda-event-radius)',
        padding: isShort ? '2px 8px 2px 10px' : '4px 8px 4px 10px',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: Z_AGENDA.eventBlock,
        transition: 'background 0.12s',
        display: 'flex',
        flexDirection: isShort ? 'row' : 'column',
        alignItems: isShort ? 'center' : 'flex-start',
        gap: isShort ? 8 : 0,
        minWidth: 0,
        textAlign: 'left',
        // Bande couleur à gauche + outline. En mode highlighted, on bumpe
        // l'outline + on ajoute un ring extérieur à la couleur du calendrier
        // pour signaler la sélection (style "click 1 = select" type Notion/Linear).
        outline: isPending ? `1.5px dashed ${event.color}` : 'none',
        outlineOffset: isPending ? -1 : 0,
        boxShadow: isPending
          ? `inset var(--agenda-event-bar-width) 0 0 ${event.color}`
          : isHighlighted
            ? `inset var(--agenda-event-bar-width) 0 0 ${event.color}, inset 0 0 0 1.5px ${event.color}, 0 0 0 2px color-mix(in srgb, ${event.color} 45%, transparent)`
            : `inset var(--agenda-event-bar-width) 0 0 ${event.color}, inset 0 0 0 1px ${outlineColor}`,
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = fillBgHover
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = fillBg
      }}
    >
      {resizable && (
        <>
          <div
            data-resize-handle="top"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              cursor: 'ns-resize',
              zIndex: 1,
            }}
          />
          <div
            data-resize-handle="bottom"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 6,
              cursor: 'ns-resize',
              zIndex: 1,
            }}
          />
        </>
      )}
      {isShort ? (
        <>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: timeColor,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {start}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
              letterSpacing: -0.1,
            }}
          >
            {event.title}
          </span>
        </>
      ) : (
        <>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              lineHeight: 1.25,
              letterSpacing: -0.15,
            }}
          >
            {event.title}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: timeColor,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {start} – {end}
          </span>
          {event.subtitle && !isMedium && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                opacity: 0.7,
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
