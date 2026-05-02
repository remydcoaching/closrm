'use client'

/**
 * Route /agenda/v2 — Phase 3a (week view statique read-only).
 *
 * Cette route coexiste avec /agenda (l'ancienne) le temps de la refonte.
 * Au cutover (Phase 8), on renommera v2/ → agenda/ et l'ancienne ira en _old/.
 *
 * Phase 3a scope :
 *   - Affichage week view uniquement (Day/Month désactivés visuellement)
 *   - Read-only : click event → log console (panneau détail = Phase 3b)
 *   - Sidebar gauche absente (= Phase 5)
 *   - Drag/create absent (= Phase 6)
 *   - Mobile non géré (= Phase 7)
 */

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useAgendaData } from '@/lib/agenda/use-agenda-data'
import type { AgendaEvent } from '@/types/agenda'
import { WeekView } from '@/components/agenda/v2/WeekView'
import { AgendaToolbar, type AgendaViewMode } from '@/components/agenda/v2/AgendaToolbar'

function formatPeriodLabel(viewMode: AgendaViewMode, date: Date): string {
  if (viewMode === 'day') return format(date, 'EEEE d MMMM yyyy', { locale: fr })
  if (viewMode === 'week') {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    const end = endOfWeek(date, { weekStartsOn: 1 })
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'd', { locale: fr })} – ${format(end, 'd MMMM yyyy', { locale: fr })}`
    }
    return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
  }
  return format(date, 'MMMM yyyy', { locale: fr })
}

export default function AgendaV2Page() {
  const [viewMode, setViewMode] = useState<AgendaViewMode>('week')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())

  const {
    events,
    calendarsLoaded,
    calendars,
    syncError,
    dismissSyncError,
  } = useAgendaData({ viewMode, currentDate })

  const periodLabel = useMemo(
    () => formatPeriodLabel(viewMode, currentDate),
    [viewMode, currentDate],
  )

  function navigatePrev() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, -1))
    else if (viewMode === 'week') setCurrentDate((d) => subWeeks(d, 1))
    else setCurrentDate((d) => subMonths(d, 1))
  }
  function navigateNext() {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1))
    else if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, 1))
    else setCurrentDate((d) => addMonths(d, 1))
  }
  function navigateToday() {
    setCurrentDate(new Date())
  }

  function handleEventClick(ev: AgendaEvent) {
    // Phase 3b ouvrira le side panel — pour l'instant juste log.
    console.log('[agenda v2] event click', ev)
  }

  const noCalendars = calendarsLoaded && calendars.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AgendaToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        disabledModes={['day', 'month']}
        periodLabel={periodLabel}
        onPrev={navigatePrev}
        onNext={navigateNext}
        onToday={navigateToday}
      />

      {syncError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
            color: 'var(--text-primary)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--color-primary)' }} />
          <span style={{ flex: 1 }}>{syncError}</span>
          <button
            type="button"
            onClick={dismissSyncError}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            Fermer
          </button>
        </div>
      )}

      {noCalendars ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Aucun calendrier configuré
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.5 }}>
            Crée ton premier calendrier de réservation pour commencer.
          </div>
          <Link
            href="/parametres/calendriers"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Configurer un calendrier
          </Link>
        </div>
      ) : (
        <WeekView date={currentDate} events={events} onEventClick={handleEventClick} />
      )}
    </div>
  )
}
