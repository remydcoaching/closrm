'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Trash2, Clock, Palette, ChevronDown } from 'lucide-react'
import { TemplateBlock, DayOfWeek } from '@/types'

interface BlockModalProps {
  block: TemplateBlock | null  // null = adding new
  day: DayOfWeek
  defaultStart?: string  // used when adding from a clicked slot
  defaultEnd?: string    // used when drag-selecting a range
  onSave: (block: TemplateBlock) => void
  onDelete?: () => void  // only when editing
  onClose: () => void
}

// ── Preset activity types with default colors ──────────────────────────────
const ACTIVITY_PRESETS: { label: string; color: string }[] = [
  { label: 'ORGANISATION', color: '#22c55e' },
  { label: 'PROSPECTION', color: '#eab308' },
  { label: 'CONTENU', color: '#3b82f6' },
  { label: 'WHATSAPP', color: '#25D366' },
  { label: 'REPAS', color: '#f97316' },
  { label: 'BILAN', color: '#8b5cf6' },
  { label: 'TRAINING', color: '#ef4444' },
  { label: 'MENTORING/FORMATION', color: '#06b6d4' },
  { label: 'STORY', color: '#ec4899' },
  { label: 'CRÉATION PROGRAMME', color: '#14b8a6' },
  { label: 'TO DO LIST', color: '#6b7280' },
]

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6b7280', '#eab308', '#14b8a6', '#f97316', '#25D366']

// Time options from 06:00 to 23:00 in 15-min steps
const TIME_OPTIONS = Array.from({ length: (23 - 6) * 4 + 1 }, (_, i) => {
  const totalMin = 6 * 60 + i * 15
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const DAY_LABEL: Record<DayOfWeek, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '6px 8px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  colorScheme: 'dark',
  transition: 'background 0.12s, border-color 0.12s',
  cursor: 'pointer',
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }
  return `${minutes} min`
}

export default function BlockModal({ block, day, defaultStart, defaultEnd, onSave, onDelete, onClose }: BlockModalProps) {
  const initialStart = block?.start ?? defaultStart ?? '09:00'
  const computeDefaultEnd = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    const endH = Math.min(h + 1, 23)
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const [title, setTitle] = useState(block?.title ?? '')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(block?.end ?? defaultEnd ?? computeDefaultEnd(initialStart))
  const [color, setColor] = useState(block?.color ?? PRESET_COLORS[0])
  const [customHex, setCustomHex] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const isEditing = block !== null

  const duration = Math.max(0, timeToMin(end) - timeToMin(start))

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({ day, title: title.trim(), start, end, color })
  }

  const handleCustomHexChange = (val: string) => {
    setCustomHex(val)
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setColor(val)
    }
  }

  const handlePresetClick = (preset: { label: string; color: string }) => {
    setTitle(preset.label)
    setColor(preset.color)
    setCustomHex('')
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 14,
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          padding: 0,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
          position: 'relative',
        }}
      >
        {/* Bande couleur à gauche, prend la couleur courante du bloc */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            background: color,
            opacity: 0.85,
            borderTopLeftRadius: 14,
            borderBottomLeftRadius: 14,
            transition: 'background 0.2s',
          }}
        />

        {/* Header eyebrow + close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px 0 20px',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-elevated)',
            zIndex: 1,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {isEditing ? 'Modifier le bloc' : 'Nouveau bloc'} · {DAY_LABEL[day]}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 22px 4px 22px' }}>
          {/* Titre — input large, sans bordure */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du bloc"
            autoFocus
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.2,
              fontFamily: 'inherit',
              padding: '6px 0 14px 0',
              marginBottom: 6,
              borderBottom: '1px solid var(--border-primary)',
              width: '100%',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Heures */}
            <Row icon={<Clock size={15} />} ariaLabel="Heures">
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                <TimeSelect value={start} onChange={setStart} />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '0 2px' }}>→</span>
                <TimeSelect value={end} onChange={setEnd} />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 4 }}>
                  · {formatDuration(duration)}
                </span>
              </div>
            </Row>

            {/* Couleur */}
            <Row icon={<Palette size={15} />} ariaLabel="Couleur" alignTop>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, padding: '4px 0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {PRESET_COLORS.map((c) => {
                    const active = color === c
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setColor(c); setCustomHex('') }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: c,
                          border: 'none',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: active
                            ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c}`
                            : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                          transition: 'box-shadow 0.12s',
                        }}
                        aria-label={`Couleur ${c}`}
                        aria-pressed={active}
                      />
                    )
                  })}
                  <input
                    type="text"
                    placeholder="#hex"
                    value={customHex}
                    onChange={(e) => handleCustomHexChange(e.target.value)}
                    maxLength={7}
                    style={{
                      width: 70,
                      background: 'transparent',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      padding: '4px 6px',
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </Row>
          </div>

          {/* Activity presets — facultatif, montrés en bas */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
            <div
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              Raccourcis
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ACTIVITY_PRESETS.map((preset) => {
                const active = title === preset.label
                const fillBg = `color-mix(in srgb, ${preset.color} 22%, transparent)`
                const outlineColor = `color-mix(in srgb, ${preset.color} 35%, transparent)`
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    style={{
                      background: active ? fillBg : 'transparent',
                      border: 'none',
                      boxShadow: `inset 0 0 0 1px ${active ? preset.color : outlineColor}`,
                      borderRadius: 6,
                      color: active ? 'var(--text-primary)' : preset.color,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      letterSpacing: 0.2,
                      transition: 'background 0.12s, box-shadow 0.12s',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-primary)',
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg-elevated)',
            marginTop: 12,
          }}
        >
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: '#ef4444',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, #ef4444 12%, transparent)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Trash2 size={13} /> Supprimer
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim()}
              style={{
                background: title.trim() ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                border: 'none',
                borderRadius: 8,
                color: '#000',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 18px',
                cursor: title.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.12s',
              }}
            >
              {isEditing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon,
  children,
  ariaLabel,
  alignTop,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  ariaLabel: string
  alignTop?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: alignTop ? 'flex-start' : 'center',
        gap: 10,
        padding: '4px 0',
      }}
    >
      <div
        aria-label={ariaLabel}
        style={{
          width: 18,
          flexShrink: 0,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: alignTop ? 8 : 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...fieldStyle,
          textAlign: 'center',
          appearance: 'none',
          WebkitAppearance: 'none',
          paddingRight: 22,
          width: 'auto',
          minWidth: 80,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: 6, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
    </div>
  )
}
