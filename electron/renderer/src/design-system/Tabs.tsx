import './tabs.css'

export interface TabItem {
  key: string
  label: string
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="ds-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`ds-tab ${item.key === active ? 'ds-tab--active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
