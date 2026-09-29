// Big-number KPI card — the ONE style for every headline figure in the app
// (reference: Insyder "Leads actifs / 114 / Lurkers acheteurs" row). Label
// top-left with a chevron when clickable, big bold figure (accent gradient
// when `highlight`), optional delta vs previous period, one-line caption.
import './stat-card.css'

export interface StatCardProps {
  label: string
  value: React.ReactNode
  /** Rendered after the figure, same weight ("1 259 profils"). */
  unit?: string
  caption?: React.ReactNode
  /** Percentage change vs previous period; sign drives the arrow. */
  delta?: number | null
  highlight?: boolean
  onClick?: () => void
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function StatCard({ label, value, unit, caption, delta, highlight, onClick }: StatCardProps) {
  const figure = typeof value === 'number' ? formatNumber(value) : value
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`ds-stat-card ${onClick ? 'ds-stat-card--clickable' : ''}`} onClick={onClick}>
      <div className="ds-stat-card-label">
        <span>{label}</span>
        {onClick && <span className="ds-stat-card-chevron">›</span>}
      </div>
      <div className={`ds-stat-card-value ${highlight ? 'ds-stat-card-value--highlight' : ''}`}>
        {figure}
        {unit && <span className="ds-stat-card-unit"> {unit}</span>}
      </div>
      {delta != null && Number.isFinite(delta) && (
        <div className={`ds-stat-card-delta ${delta < 0 ? 'ds-stat-card-delta--down' : ''}`}>
          {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}
          {formatNumber(Math.round(delta))} % vs période précédente
        </div>
      )}
      {caption && <div className="ds-stat-card-caption">{caption}</div>}
    </Tag>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="ds-stat-grid">{children}</div>
}
