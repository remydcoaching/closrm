// Renders a {label, color, bg} entry (status or source) as a colored pill —
// same visual language as StatusBadge/SourceBadge on the ClosRM web app,
// rebuilt here rather than imported (no shared component package yet).
import './status-pill.css'

export function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="ds-status-pill" style={{ color, background: bg }}>
      {label}
    </span>
  )
}
