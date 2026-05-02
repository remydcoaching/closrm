'use client'

/**
 * Tooltip riche pour un événement (Phase 3b). Wrap autour de Radix Tooltip avec
 * delay 400ms (cf. anti-pattern flicker souris).
 *
 * Affichage :
 *  Léa Martin
 *  Jeu 1 mai · 09:30 — 10:00
 *  Setting · Google Meet
 *  ✉ lea@coach.fr
 */

import { addMinutes, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import type { AgendaEvent } from '@/types/agenda'
import { Z_AGENDA } from '@/lib/agenda/z-index'

interface EventTooltipProps {
  event: AgendaEvent
  children: ReactNode
}

export function EventTooltip({ event, children }: EventTooltipProps) {
  const start = parseISO(event.start)
  const end = addMinutes(start, event.durationMinutes)
  const dateLine = `${format(start, 'EEE d MMM', { locale: fr })} · ${format(start, 'HH:mm')} — ${format(end, 'HH:mm')}`

  return (
    <Tooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-secondary)',
              borderRadius: 8,
              padding: '10px 12px',
              maxWidth: 280,
              zIndex: Z_AGENDA.popover,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: event.color,
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.title}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {dateLine}
              </div>
              {event.subtitle && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{event.subtitle}</div>
              )}
              {event.kind === 'booking' && event.booking.location?.name && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  📍 {event.booking.location.name}
                </div>
              )}
              {event.lead?.email && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>✉ {event.lead.email}</div>
              )}
            </div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
