'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Trash2 } from 'lucide-react'
import { TemplateBlock, DayOfWeek } from '@/types'

interface BlockModalProps {
  block: TemplateBlock | null  // null = adding new
  day: DayOfWeek
  defaultStart?: string  // used when adding from a clicked slot
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

// Time options from 06:00 to 23:00 in 30-min steps
const TIME_OPTIONS = Array.from({ length: (23 - 6) * 2 + 1 }, (_, i) => {
  const h = Math.floor(i / 2) + 6
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-secondary)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginBottom: 6,
}

export default function BlockModal({ block, day, defaultStart, onSave, onDelete, onClose }: BlockModalProps) {
  const initialStart = block?.start ?? defaultStart ?? '09:00'
  // Default end = start + 1 hour
  const computeDefaultEnd = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    const endH = Math.min(h + 1, 23)
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const [title, setTitle] = useState(block?.title ?? '')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(block?.end ?? computeDefaultEnd(initialStart))
  const [color, setColor] = useState(block?.color ?? PRESET_COLORS[0])
  const [customHex, setCustomHex] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const isEditing = block !== null

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 12,
          width: 480,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
            {isEditing ? 'Modifier le bloc' : 'Ajouter un bloc'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 2 }}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Activity presets */}
            <div>
              <label style={labelStyle}>Type d&apos;activit&eacute; (raccourcis)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ACTIVITY_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    style={{
                      background: title === preset.label ? preset.color : 'transparent',
                      border: `1px solid ${preset.color}`,
                      borderRadius: 6,
                      color: title === preset.label ? '#fff' : preset.color,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      transition: 'all 0.1s',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Titre personnalis&eacute;</label>
              <input
                type="text"
                placeholder="Ex: Appels clients, Prospection..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            {/* Start / End */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>D&eacute;but</label>
                <select
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fin</label>
                <select
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label style={labelStyle}>Couleur</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setColor(c); setCustomHex('') }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                      outline: color === c ? '2px solid var(--bg-elevated)' : 'none',
                      outlineOffset: -4,
                      transition: 'border-color 0.1s',
                    }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
                {/* Custom hex */}
                <input
                  type="text"
                  placeholder="#ffffff"
                  value={customHex}
                  onChange={e => handleCustomHexChange(e.target.value)}
                  maxLength={7}
                  style={{
                    ...inputStyle,
                    width: 80,
                    fontSize: 11,
                    padding: '4px 6px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              {/* Color preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{
                  width: 32, height: 12, borderRadius: 4, background: color,
                  border: '1px solid rgba(255,255,255,0.1)',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{color}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <div>
                {isEditing && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'none',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 8,
                      color: '#ef4444',
                      fontSize: 13,
                      padding: '7px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    Supprimer
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    padding: '8px 16px',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '8px 20px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {isEditing ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
