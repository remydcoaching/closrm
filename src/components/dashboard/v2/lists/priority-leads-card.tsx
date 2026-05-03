'use client'

import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { PriorityLead } from '@/lib/dashboard/v2-queries'

interface Props {
  title: string
  Icon: LucideIcon
  iconColor: string
  contextColor: string
  emptyLabel: string
  leads: PriorityLead[]
  onLeadClick: (leadId: string) => void
}

export default function PriorityLeadsCard({
  title,
  Icon,
  iconColor,
  contextColor,
  emptyLabel,
  leads,
  onLeadClick,
}: Props) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 16,
        minHeight: 180,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={14} color={iconColor} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-label)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{leads.length}</span>
      </div>
      {leads.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emptyLabel}</div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {leads.map(l => (
            <li key={l.id}>
              <button
                onClick={() => onLeadClick(l.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  color: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.name}
                </span>
                <span style={{ fontSize: 11, color: contextColor }}>{l.context}</span>
                <ChevronRight size={12} color="var(--text-muted)" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
