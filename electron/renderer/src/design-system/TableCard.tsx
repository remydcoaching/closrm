// The ONE table style for the app (reference: Insyder "Lurkers acheteurs ·
// 30 j" table): a rounded card with a title/subtitle on the left and a pill
// toolbar on the right, then a `ds-table` — light grey sortable headers,
// airy rows, avatar + bold name + pink @handle, figures in bold mono.
import './data-table.css'

export function TableCard({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="ds-table-card">
      {(title || toolbar) && (
        <header className="ds-table-card-header">
          <div>
            {title && <h2 className="ds-table-card-title">{title}</h2>}
            {subtitle && <p className="ds-table-card-subtitle">{subtitle}</p>}
          </div>
          {toolbar && <div className="ds-table-card-toolbar">{toolbar}</div>}
        </header>
      )}
      <div className="ds-table-scroll">{children}</div>
    </section>
  )
}

/** Sortable column header with the up/down indicator from the reference. */
export function SortHeader({
  label,
  active,
  order,
  onClick,
  align,
}: {
  label: string
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
  align?: 'right'
}) {
  return (
    <th className={`ds-th-sortable ${align === 'right' ? 'ds-num-cell' : ''}`} onClick={onClick}>
      {label}
      <span className={`ds-sort-indicator ${active ? 'ds-sort-indicator--active' : ''}`}>{active ? (order === 'asc' ? '▲' : '▼') : '⬍'}</span>
    </th>
  )
}

/** Avatar + bold name + pink @handle cell content. */
export function ContactCell({ name, handle, avatar }: { name: string; handle?: string | null; avatar: React.ReactNode }) {
  return (
    <div className="ds-contact">
      {avatar}
      <div className="ds-contact-text">
        <div className="ds-contact-name">{name}</div>
        {handle && <div className="ds-contact-handle">@{handle}</div>}
      </div>
    </div>
  )
}
