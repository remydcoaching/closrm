'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'
import type { DateField, DatePreset, DateFilterPref } from '@/lib/ui-prefs/leads-prefs'
import { computeRange } from '@/lib/ui-prefs/leads-prefs'

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all',       label: 'Tout' },
  { value: 'today',     label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: '7d',        label: '7j' },
  { value: '30d',       label: '30j' },
  { value: 'custom',    label: 'Personnalisé' },
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

// Styles gérés par la classe .period-pill dans globals.css
// pour garantir l'absence de focus ring résiduel.

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    if (value.preset === 'custom' && value.from && value.to) {
      return { from: new Date(value.from), to: new Date(value.to) }
    }
    return undefined
  })

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setCustomOpen(false)
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) setFieldOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function applyPreset(preset: DatePreset) {
    if (preset === 'custom') {
      onChange({ ...value, preset })
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
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
    setFieldOpen(false)
    if (value.preset === 'all') {
      onChange({ ...value, field })
      return
    }
    const { from, to } = computeRange(value.preset, { from: value.from, to: value.to })
    onChange({ preset: value.preset, from, to, field })
  }

  const fieldLabel = FIELDS.find(f => f.value === value.field)?.label ?? 'Création'
  const customLabel = value.preset === 'custom' && value.from && value.to
    ? `${format(new Date(value.from), 'd MMM', { locale: fr })} – ${format(new Date(value.to), 'd MMM', { locale: fr })}`
    : 'Personnalisé'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map(p => {
        const active = value.preset === p.value
        const label = p.value === 'custom' ? customLabel : p.label
        return (
          <div key={p.value} style={{ position: 'relative' }} ref={p.value === 'custom' ? popRef : undefined}>
            <button
              type="button"
              className={`period-pill${active ? ' is-active' : ''}`}
              onClick={(e) => { applyPreset(p.value); e.currentTarget.blur() }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {label}
            </button>

            {p.value === 'custom' && customOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: 10,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}>
                <DayPicker
                  mode="range"
                  selected={customRange}
                  onSelect={applyCustom}
                  locale={fr}
                  numberOfMonths={1}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Champ de date — discret à droite */}
      <div style={{ position: 'relative' }} ref={fieldRef}>
        <button
          type="button"
          className="period-pill"
          onClick={(e) => { setFieldOpen(o => !o); e.currentTarget.blur() }}
          onMouseDown={(e) => e.preventDefault()}
          title="Champ de date"
          style={{
            padding: '5px 10px',
            fontSize: 11,
            border: '1px dashed var(--border-primary)',
            marginLeft: 4,
          }}
        >
          {fieldLabel}
        </button>

        {fieldOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            borderRadius: 10, padding: 6, minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {FIELDS.map(f => {
              const active = value.field === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => applyField(f.value)}
                  style={{
                    textAlign: 'left', padding: '6px 10px', borderRadius: 6, fontSize: 12,
                    border: 'none', cursor: 'pointer',
                    background: active ? 'rgba(0,200,83,0.12)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
