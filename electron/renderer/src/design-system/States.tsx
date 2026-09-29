import './states.css'

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="ds-state">
      <div className="ds-spinner" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ds-state ds-state--error">
      <p>{message}</p>
      {onRetry && (
        <button className="ds-state-retry" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="ds-state">
      <p className="ds-state-title">{title}</p>
      {description && <p>{description}</p>}
    </div>
  )
}
