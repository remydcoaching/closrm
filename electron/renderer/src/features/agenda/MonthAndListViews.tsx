// Month grid (port of components/agenda/v2/MonthView) and the list view
// (every event of the period in a TableCard).
import { useMemo } from 'react'
import { TableCard } from '../../design-system/TableCard'
import { StatusPill } from '../../design-system/StatusPill'
import { EmptyState } from '../../design-system/States'
import {
  STATUS_META,
  addDays,
  addMinutes,
  eventStatus,
  eventsForDay,
  formatDuration,
  isSameDay,
  startOfMonth,
  startOfWeek,
  toTimeInput,
} from './agenda-utils'
import type { AgendaEvent } from './types'

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const MAX_PER_CELL = 3

export function MonthView({
  date,
  events,
  highlightedId,
  onEventClick,
  onDayClick,
}: {
  date: Date
  events: AgendaEvent[]
  highlightedId: string | null
  onEventClick: (ev: AgendaEvent) => void
  onDayClick: (day: Date) => void
}) {
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(date))
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [date])
  const today = new Date()

  return (
    <div className="agenda-month">
      <div className="agenda-month-head">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="agenda-month-grid">
        {days.map((d) => {
          const list = eventsForDay(events, d).sort((a, b) => a.start.localeCompare(b.start))
          const inMonth = d.getMonth() === date.getMonth()
          return (
            <div
              key={d.toISOString()}
              className={`agenda-month-cell ${inMonth ? '' : 'agenda-month-cell--out'}`}
              onClick={() => onDayClick(d)}
            >
              <span className={`agenda-month-day ${isSameDay(d, today) ? 'agenda-month-day--today' : ''}`}>{d.getDate()}</span>
              {list.slice(0, MAX_PER_CELL).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`agenda-month-event ${highlightedId === ev.id ? 'agenda-month-event--highlighted' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEventClick(ev)
                  }}
                  title={ev.title}
                >
                  <span className="agenda-dot" style={{ background: ev.color }} />
                  <span className="font-mono">{toTimeInput(new Date(ev.start))}</span>
                  <span>{ev.title}</span>
                </button>
              ))}
              {list.length > MAX_PER_CELL && <span className="agenda-more">+{list.length - MAX_PER_CELL} autres</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function locationLabel(ev: AgendaEvent): string {
  if (ev.kind === 'call') return '—'
  if (ev.booking.meet_url) return 'Google Meet'
  if (ev.booking.location) return ev.booking.location.name
  return '—'
}

function typeLabel(ev: AgendaEvent): string {
  if (ev.kind === 'call') return `Appel ${ev.subtitle ?? ''}`.trim()
  if (ev.booking.source === 'google_sync') return 'Google Calendar'
  if (ev.booking.is_personal) return 'Horaire bloqué'
  return ev.subtitle ?? 'Rendez-vous'
}

export function ListView({
  events,
  periodLabel,
  onEventClick,
}: {
  events: AgendaEvent[]
  periodLabel: string
  onEventClick: (ev: AgendaEvent) => void
}) {
  const sorted = useMemo(() => [...events].sort((a, b) => a.start.localeCompare(b.start)), [events])
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="agenda-list-scroll">
      <TableCard title="Rendez-vous" subtitle={`${sorted.length} événement${sorted.length > 1 ? 's' : ''} · ${periodLabel}`}>
        {sorted.length === 0 ? (
          <EmptyState title="Aucun événement" description="Rien de planifié sur cette période." />
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Horaire</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Lieu</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ev) => {
                const start = new Date(ev.start)
                const status = STATUS_META[eventStatus(ev)]
                const personal = ev.kind === 'booking' && ev.booking.is_personal
                return (
                  <tr key={ev.id} className="ds-row-clickable" onClick={() => onEventClick(ev)}>
                    <td className="ds-num-cell" style={{ textAlign: 'left' }}>
                      <span className="ds-num">{dateFmt.format(start)}</span>
                    </td>
                    <td className="ds-num-cell" style={{ textAlign: 'left' }}>
                      <span className="ds-num">
                        {toTimeInput(start)}–{toTimeInput(addMinutes(start, ev.durationMinutes))}
                      </span>{' '}
                      <span className="ds-muted">{formatDuration(ev.durationMinutes)}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span className="agenda-dot" style={{ background: ev.color }} />
                        <strong>{ev.title}</strong>
                      </span>
                    </td>
                    <td className="ds-muted">{typeLabel(ev)}</td>
                    <td className="ds-muted">{locationLabel(ev)}</td>
                    <td>{personal ? <span className="ds-muted">—</span> : <StatusPill {...status} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  )
}
