// A multi-select dropdown filter (status/source/tags) — same interaction
// pattern as LeadFilters.tsx on the web (chips + panel), rebuilt with our
// own components rather than imported.
import { useEffect, useRef, useState } from 'react'
import './filter-menu.css'

export interface FilterOption {
  key: string
  label: string
  color?: string
}

export function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  return (
    <div className="ds-filter-menu" ref={ref}>
      <button type="button" className={`ds-filter-trigger ${selected.length > 0 ? 'ds-filter-trigger--active' : ''}`} onClick={() => setOpen((v) => !v)}>
        {label}
        {selected.length > 0 && <span className="ds-filter-count">{selected.length}</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="ds-filter-panel">
          <div className="ds-filter-panel-header">
            <span>{label}</span>
            {selected.length > 0 && (
              <button type="button" className="ds-filter-clear" onClick={() => onChange([])}>
                Effacer
              </button>
            )}
          </div>
          <div className="ds-filter-options">
            {options.map((opt) => {
              const active = selected.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`ds-filter-option ${active ? 'ds-filter-option--active' : ''}`}
                  style={active && opt.color ? { borderColor: opt.color, color: opt.color, background: `${opt.color}18` } : undefined}
                  onClick={() => toggle(opt.key)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
