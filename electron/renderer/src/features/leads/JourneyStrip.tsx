// "Son parcours — chaque jour où il s'est passé quelque chose, et ce que vous
// en avez fait" (reference: Insyder lead page). Horizontal strip of days on
// a line; clicking a day opens "Ce jour-là" with every gesture of that day.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chips } from '../../design-system/Tabs'
import { Drawer } from '../../design-system/Drawer'
import type { ActivityEntry } from '../../design-system/ActivityTimeline'
import { groupJourneyDays, type JourneyDay } from './journey-days'
import './journey-strip.css'

type Range = 'all' | '30' | '7'

function dayLabel(day: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts)
}

export function JourneyStrip({ entries }: { entries: ActivityEntry[] }) {
  const [range, setRange] = useState<Range>('all')
  const [open, setOpen] = useState<JourneyDay | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86_400_000).toISOString()
    return groupJourneyDays(entries, since)
  }, [entries, range])

  // Most recent days first in view.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [days])

  return (
    <section className="journey">
      <header className="journey-header">
        <div>
          <h2>Son parcours</h2>
          <p>Chaque jour où il s&apos;est passé quelque chose, et ce que vous en avez fait</p>
        </div>
        <Chips
          items={[
            { key: 'all' as Range, label: 'Tout' },
            { key: '30' as Range, label: '30 jours' },
            { key: '7' as Range, label: '7 jours' },
          ]}
          active={range}
          onChange={setRange}
        />
      </header>

      {days.length === 0 ? (
        <p className="journey-empty">Rien sur cette période.</p>
      ) : (
        <div className="journey-scroll" ref={scroller}>
          <div className="journey-track" style={{ minWidth: days.length * 118 }}>
            {days.map((d) => (
              <button
                key={d.day}
                type="button"
                className={`journey-day ${open?.day === d.day ? 'journey-day--active' : ''}`}
                onClick={() => setOpen(d)}
              >
                <span className="journey-day-date">{dayLabel(d.day, { day: 'numeric', month: 'short' })}</span>
                <span className="journey-day-icons">
                  {d.entries.slice(0, 3).map((e) => (
                    <span key={e.id} className="journey-day-icon">
                      {e.icon}
                    </span>
                  ))}
                  {d.entries.length > 3 && <span className="journey-day-more">+{d.entries.length - 3}</span>}
                </span>
                <span className="journey-day-summary">{d.summary}</span>
                <span className="journey-dot" />
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <Drawer title="Ce jour-là" onClose={() => setOpen(null)}>
          <div className="journey-panel">
            <div className="journey-panel-count">
              {open.entries.length} geste{open.entries.length > 1 ? 's' : ''}
            </div>
            <div className="journey-panel-date">{dayLabel(open.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="journey-panel-section">Ce qu&apos;il a fait</div>
            {open.entries.map((e) => (
              <div key={e.id} className="journey-panel-item">
                <span className="journey-day-icon">{e.icon}</span>
                <div>
                  <div className="journey-panel-title">{e.title}</div>
                  {e.detail && <div className="journey-panel-detail">{e.detail}</div>}
                  <div className="journey-panel-time">{new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </section>
  )
}
