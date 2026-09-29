// A right-docked contextual drawer — used for "Pourquoi ce score ?" and
// similar explanatory panels (§ Insyder reference: contextual side panel
// explaining a score/signal), rebuilt with our own tokens.
import './drawer.css'

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ds-drawer-overlay" onClick={onClose}>
      <div className="ds-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ds-drawer-header">
          <span>{title}</span>
          <button onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="ds-drawer-body">{children}</div>
      </div>
    </div>
  )
}
