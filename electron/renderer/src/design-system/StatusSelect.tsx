// A dropdown that changes lead.status via the SAME PATCH /api/leads/:id the
// web already uses (see LeadSidePanel.tsx on web) — this component only
// renders the picker, it never decides the endpoint or the allowed values.
import { useEffect, useRef, useState } from 'react'
import { StatusPill } from './StatusPill'
import './status-select.css'

export interface SelectEntry {
  key: string
  label: string
  color: string
  bg: string
}

export function StatusSelect({
  entries,
  value,
  onChange,
  disabled,
}: {
  entries: SelectEntry[]
  value: string
  onChange: (key: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = entries.find((e) => e.key === value) ?? { key: value, label: value, color: '#8a8e96', bg: 'rgba(138,142,150,0.12)' }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="ds-status-select" ref={ref}>
      <button
        type="button"
        className="ds-status-select-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <StatusPill label={current.label} color={current.color} bg={current.bg} />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="ds-status-select-panel">
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              className="ds-status-select-option"
              style={e.key === value ? { background: e.bg, color: e.color } : undefined}
              onClick={() => {
                setOpen(false)
                if (e.key !== value) onChange(e.key)
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
