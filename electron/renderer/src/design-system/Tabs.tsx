import './tabs.css'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  /** Optional figure shown next to the label (chips only). */
  count?: number
}

/** Segmented control — "Interactions | Score". */
export function Tabs<K extends string>({ items, active, onChange }: { items: TabItem<K>[]; active: K; onChange: (key: K) => void }) {
  return (
    <div className="ds-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === active}
          className={`ds-tab ${item.key === active ? 'ds-tab--active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** Separate pills — "Depuis la première analyse | Tout | 30 jours | 7 jours". */
export function Chips<K extends string>({ items, active, onChange }: { items: TabItem<K>[]; active: K | null; onChange: (key: K) => void }) {
  return (
    <div className="ds-chips">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === active}
          className={`ds-chip ${item.key === active ? 'ds-chip--active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined && <span className="ds-chip-count">{new Intl.NumberFormat('fr-FR').format(item.count)}</span>}
        </button>
      ))}
    </div>
  )
}
