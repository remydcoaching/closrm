'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Zap, Clock, GitBranch, Timer } from 'lucide-react'
import { WorkflowStepType } from '@/types'

interface Props {
  onAdd: (stepType: WorkflowStepType) => void
}

const options: { type: WorkflowStepType; label: string; desc: string; icon: typeof Zap; color: string; bg: string }[] = [
  { type: 'action', label: 'Action', desc: 'Email, WhatsApp, statut...', icon: Zap, color: '#5b9bf5', bg: 'rgba(91,155,245,0.08)' },
  { type: 'delay', label: 'Delai', desc: 'Attendre X minutes/heures', icon: Clock, color: '#D69E2E', bg: 'rgba(214,158,46,0.08)' },
  { type: 'condition', label: 'Condition', desc: 'Si/Sinon (branchement)', icon: GitBranch, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { type: 'wait_for_event', label: 'Attendre', desc: 'Avant un RDV/appel', icon: Timer, color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
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
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px dashed ${hovered || open ? '#E53E3E' : 'var(--border-primary)'}`,
          background: hovered || open ? 'rgba(229,62,62,0.06)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: hovered || open ? '#E53E3E' : 'var(--text-label)',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
      >
        <Plus size={16} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: 6,
            zIndex: 10,
            minWidth: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {options.map((opt) => {
            const Icon = opt.icon
            const isHovered = hoveredOption === opt.type
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
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: isHovered ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: opt.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color: opt.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: opt.color }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
