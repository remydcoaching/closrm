'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'
import type { DateField, DatePreset, DateFilterPref } from '@/lib/ui-prefs/leads-prefs'
import { computeRange } from '@/lib/ui-prefs/leads-prefs'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',     label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: '7d',        label: '7 derniers jours' },
  { value: '30d',       label: '30 derniers jours' },
  { value: 'custom',    label: 'Personnalisé' },
  { value: 'all',       label: 'Tout' },
]

const FIELDS: { value: DateField; label: string }[] = [
  { value: 'created_at', label: 'Création' },
  { value: 'updated_at', label: 'Mise à jour' },
  { value: 'closed_at',  label: 'Clôture' },
]

interface DateRangePickerProps {
  value: DateFilterPref
  onChange: (v: DateFilterPref) => void
}

function labelForPreset(p: DatePreset, from?: string, to?: string) {
  if (p === 'all') return 'Toutes les dates'
  if (p === 'custom' && from && to) {
    return `${format(new Date(from), 'd MMM', { locale: fr })} – ${format(new Date(to), 'd MMM', { locale: fr })}`
  }
  return PRESETS.find(x => x.value === p)?.label ?? 'Date'
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    if (value.preset === 'custom' && value.from && value.to) {
      return { from: new Date(value.from), to: new Date(value.to) }
    }
    return undefined
  })

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function applyPreset(preset: DatePreset) {
    if (preset === 'custom') {
      onChange({ ...value, preset })
      return
    }
    const { from, to } = computeRange(preset)
    onChange({ preset, from, to, field: value.field })
  }

  function applyCustom(range: DateRange | undefined) {
    setCustomRange(range)
    if (range?.from && range.to) {
      const from = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0).toISOString()
      const to   = new Date(range.to.getFullYear(),   range.to.getMonth(),   range.to.getDate(),   23, 59, 59, 999).toISOString()
      onChange({ preset: 'custom', from, to, field: value.field })
    }
  }

  function applyField(field: DateField) {
    if (value.preset === 'all') {
      onChange({ ...value, field })
      return
    }
    const { from, to } = computeRange(value.preset, { from: value.from, to: value.to })
    onChange({ preset: value.preset, from, to, field })
  }

  const isActive = value.preset !== 'all'

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          border: isActive || open ? '1px solid rgba(0,200,83,0.4)' : '1px solid var(--border-primary)',
          background: isActive || open ? 'rgba(0,200,83,0.08)' : 'var(--bg-elevated)',
          color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={14} />
        {labelForPreset(value.preset, value.from, value.to)}
        <span style={{ opacity: 0.7, fontWeight: 500 }}>
          · {FIELDS.find(f => f.value === value.field)?.label}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 14, minWidth: 320,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PRESETS.map(p => {
              const active = value.preset === p.value
              return (
                <button key={p.value} type="button" onClick={() => applyPreset(p.value)} style={{
                  textAlign: 'left', padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(0,200,83,0.12)' : 'transparent',
                  color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}>
                  {p.label}
                </button>
              )
            })}
          </div>

          {value.preset === 'custom' && (
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
              <DayPicker
                mode="range"
                selected={customRange}
                onSelect={applyCustom}
                locale={fr}
                numberOfMonths={1}
              />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              Champ
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FIELDS.map(f => {
                const active = value.field === f.value
                return (
                  <button key={f.value} type="button" onClick={() => applyField(f.value)} style={{
                    padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    border: active ? '1px solid rgba(0,200,83,0.4)' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(0,200,83,0.12)' : 'transparent',
                    color: active ? 'var(--color-primary)' : '#777',
                    cursor: 'pointer',
                  }}>
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
