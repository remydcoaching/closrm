'use client'

import { useState } from 'react'
import { Phone, PhoneCall, Calendar } from 'lucide-react'
import type { CalendarPurpose } from '@/types'

interface PurposeEditorProps {
  value: CalendarPurpose
  onChange: (purpose: CalendarPurpose) => void
}

const PURPOSES: { value: CalendarPurpose; label: string; description: string; icon: typeof Phone }[] = [
  {
    value: 'setting',
    label: 'Appel découverte',
    description: 'Qualification du prospect, premier contact',
    icon: Phone,
  },
  {
    value: 'closing',
    label: 'Appel de closing',
    description: 'Appel de vente, conversion du prospect',
    icon: PhoneCall,
  },
  {
    value: 'other',
    label: 'Autre',
    description: 'Coaching, suivi, mentoring...',
    icon: Calendar,
  },
]

export default function PurposeEditor({ value, onChange }: PurposeEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Quel est l&apos;objectif de ce calendrier ?
      </p>
      {PURPOSES.map((p) => {
        const isSelected = value === p.value
        const Icon = p.icon
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
              background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.06)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.12)' : 'var(--bg-active, rgba(255,255,255,0.04))',
              color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              <Icon size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                marginBottom: 2,
              }}>
                {p.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {p.description}
              </div>
            </div>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {isSelected && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
