'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Zap, Clock, GitBranch } from 'lucide-react'
import { WorkflowStepType } from '@/types'

interface Props {
  onAdd: (stepType: WorkflowStepType) => void
}

const options: { type: WorkflowStepType; label: string; icon: typeof Zap; color: string }[] = [
  { type: 'action', label: 'Action', icon: Zap, color: '#5b9bf5' },
  { type: 'delay', label: 'Délai', icon: Clock, color: '#D69E2E' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: '#5b9bf5' },
]

export default function AddStepButton({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px dashed ${hovered || open ? 'var(--color-primary)' : 'var(--border-primary)'}`,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: hovered || open ? 'var(--color-primary)' : 'var(--text-label)',
          transition: 'all 0.15s',
          padding: 0,
        }}
      >
        <Plus size={18} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 42,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: 4,
            zIndex: 10,
            minWidth: 140,
          }}
        >
          {options.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.type}
                onMouseEnter={() => setHoveredOption(opt.type)}
                onMouseLeave={() => setHoveredOption(null)}
                onClick={() => {
                  onAdd(opt.type)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: opt.color,
                  background: hoveredOption === opt.type ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
