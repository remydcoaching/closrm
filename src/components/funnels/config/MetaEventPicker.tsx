'use client'

/**
 * Intuitive Meta event selector used in FormBlock + BookingBlock config
 * panels of the funnel builder.
 *
 * Shows a French business label per option ("C'est un lead qualifié")
 * with the underlying Meta event name as a hint, plus a custom-name input
 * when the coach picks "Event Meta personnalisé".
 */

import { META_EVENT_OPTIONS, type MetaEventConfig, type MetaEventChoice } from '@/lib/meta/funnel-events'

interface Props {
  /** Current value (undefined = treat as `defaultChoice`). */
  value: MetaEventConfig | undefined | null
  onChange: (next: MetaEventConfig) => void
  /** Choice to highlight as the recommended default for this block type. */
  defaultChoice: MetaEventChoice
  /** Section heading shown above the picker. */
  title?: string
}

export default function MetaEventPicker({ value, onChange, defaultChoice, title = 'Event Meta' }: Props) {
  const current: MetaEventChoice = value?.type ?? defaultChoice
  const selectedOpt = META_EVENT_OPTIONS.find(o => o.value === current)

  return (
    <div style={{ marginTop: 4 }}>
      <label style={labelStyle}>{title}</label>
      <p style={helperStyle}>
        Choisis ce que ClosRM doit remonter à Meta à ce moment-là. Tu peux laisser « Ne rien envoyer » si t'en veux pas.
      </p>

      <select
        value={current}
        onChange={(e) => {
          const next = e.target.value as MetaEventChoice
          onChange({ type: next, customName: value?.customName })
        }}
        style={inputStyle}
      >
        {META_EVENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
            {opt.event && opt.event !== 'CUSTOM' ? ` — ${opt.event}` : ''}
          </option>
        ))}
      </select>

      {selectedOpt && (
        <p style={subHelperStyle}>{selectedOpt.helper}</p>
      )}

      {current === 'custom' && (
        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>Nom de l&apos;event personnalisé</label>
          <input
            type="text"
            placeholder="Ex: MyCustomEvent"
            value={value?.customName ?? ''}
            onChange={(e) => onChange({ type: 'custom', customName: e.target.value })}
            style={inputStyle}
          />
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#555', display: 'block', marginBottom: 4,
}

const helperStyle: React.CSSProperties = {
  fontSize: 11, color: '#777', margin: '0 0 6px', lineHeight: 1.5,
}

const subHelperStyle: React.CSSProperties = {
  fontSize: 11, color: '#888', margin: '6px 0 0', fontStyle: 'italic',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
