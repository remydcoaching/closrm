import './badge.css'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>
}
