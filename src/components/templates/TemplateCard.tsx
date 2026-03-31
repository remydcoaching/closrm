'use client'

import Link from 'next/link'
import { Settings, Trash2 } from 'lucide-react'
import { PlanningTemplate, DayOfWeek } from '@/types'

interface TemplateCardProps {
  template: PlanningTemplate
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const DAY_LABELS: Record<string, string> = {
  monday: 'L',
  tuesday: 'M',
  wednesday: 'M',
  thursday: 'J',
  friday: 'V',
  saturday: 'S',
  sunday: 'D',
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const blockCount = template.blocks.length

  // Unique days that have at least one block
  const activeDays = new Set<DayOfWeek>(template.blocks.map(b => b.day))

  // Build a brief summary: "lun, mar, jeu"
  const daysSummary = DAY_ORDER.filter(d => activeDays.has(d as DayOfWeek))

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Name + block count */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {template.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            background: 'var(--bg-hover)',
            borderRadius: 20,
            padding: '3px 9px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {blockCount} {blockCount === 1 ? 'bloc' : 'blocs'}
        </span>
      </div>

      {/* Description */}
      {template.description && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
      )}

      {/* Day pills */}
      {daysSummary.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {DAY_ORDER.map(day => {
            const isActive = activeDays.has(day as DayOfWeek)
            return (
              <span
                key={day}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'var(--color-primary)' : 'var(--bg-hover)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  transition: 'background 0.15s ease',
                }}
              >
                {DAY_LABELS[day]}
              </span>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderTop: '1px solid var(--border-primary)',
          paddingTop: 12,
          marginTop: 2,
        }}
      >
        <Link
          href={`/agenda/templates/${template.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-secondary)',
            background: 'var(--bg-hover)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Settings size={12} />
          Modifier
        </Link>
        <button
          onClick={() => onDelete(template.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 500,
            color: '#ef4444',
            background: 'none',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 6,
            padding: '5px 12px',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Trash2 size={12} />
          Supprimer
        </button>
      </div>
    </div>
  )
}
