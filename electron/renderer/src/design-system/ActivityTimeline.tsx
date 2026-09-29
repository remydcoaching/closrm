import './activity-timeline.css'

export interface ActivityEntry {
  id: string
  at: string
  icon: React.ReactNode
  title: string
  detail?: string
  /** Gesture category, used by the journey strip summaries (like, comment, story_view, dm, mention, call, relance, funnel). */
  kind?: string
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  if (isSameDay) return "Aujourd'hui"
  if (isYesterday) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Groups already-sorted (desc) entries by day label, preserving order. */
function groupByDay(entries: ActivityEntry[]): { day: string; items: ActivityEntry[] }[] {
  const groups: { day: string; items: ActivityEntry[] }[] = []
  for (const entry of entries) {
    const day = dayLabel(entry.at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(entry)
    else groups.push({ day, items: [entry] })
  }
  return groups
}

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="ds-activity-empty">Aucune activité enregistrée pour ce lead.</p>
  }

  const groups = groupByDay(entries)

  return (
    <div className="ds-activity-timeline">
      {groups.map((group) => (
        <div key={group.day} className="ds-activity-group">
          <div className="ds-activity-day-label">{group.day}</div>
          {group.items.map((item) => (
            <div key={item.id} className="ds-activity-item">
              <div className="ds-activity-time font-mono">{timeLabel(item.at)}</div>
              <div className="ds-activity-icon">{item.icon}</div>
              <div className="ds-activity-body">
                <div className="ds-activity-title">{item.title}</div>
                {item.detail && <div className="ds-activity-detail">{item.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
