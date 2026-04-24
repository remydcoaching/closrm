'use client'

/**
 * Panneau Direction artistique de la sidebar. Mirror de
 * `funnels/v2/sidebar/DirectionArtistiquePanel.tsx` adapté aux emails :
 * - 4 presets featured + bouton "Voir tous (8)"
 * - 4 pickers couleur (primary, background, containerBg, footerBg) +
 *   toggle 🔗 lier fonds
 * - Selector typography (4 options)
 * - Selector boutons (sharp/rounded/pill + shadow)
 */

import { useState } from 'react'
import { Link as LinkIcon, Unlink } from 'lucide-react'
import {
  EMAIL_PRESETS,
  FEATURED_EMAIL_PRESET_IDS,
  getEmailPresetByIdOrDefault,
} from '@/lib/email/presets'
import type { EmailFontFamily, EmailButtonShape, EmailPresetOverride } from '@/lib/email/design-types'

interface Props {
  presetId: string
  presetOverride: EmailPresetOverride | null
  onDesignChange: (changes: {
    presetId?: string
    presetOverride?: EmailPresetOverride | null
  }) => void
}

const FONT_OPTIONS: { label: string; value: EmailFontFamily }[] = [
  { label: 'Sans', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Display', value: "'Playfair Display', Georgia, serif" },
  { label: 'Mono', value: "'JetBrains Mono', 'Courier New', monospace" },
]

const BUTTON_SHAPE_OPTIONS: { label: string; value: EmailButtonShape }[] = [
  { label: 'Carré', value: 'sharp' },
  { label: 'Arrondi', value: 'rounded' },
  { label: 'Pilule', value: 'pill' },
]

export default function EmailDirectionArtistiquePanel({
  presetId,
  presetOverride,
  onDesignChange,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const [linkBackgrounds, setLinkBackgrounds] = useState(true)
  const preset = getEmailPresetByIdOrDefault(presetId)

  const visiblePresets = showAll
    ? EMAIL_PRESETS
    : EMAIL_PRESETS.filter((p) => (FEATURED_EMAIL_PRESET_IDS as readonly string[]).includes(p.id))

  const resolved = {
    primary: presetOverride?.primary ?? preset.primary,
    background: presetOverride?.background ?? preset.background,
    containerBg: presetOverride?.containerBg ?? preset.containerBg,
    footerBg: presetOverride?.footerBg ?? preset.footerBg,
    fontFamily: presetOverride?.fontFamily ?? preset.fontFamily,
    buttonShape: presetOverride?.buttonShape ?? preset.buttonShape,
    buttonShadow: presetOverride?.buttonShadow ?? preset.buttonShadow,
  }

  function updateOverride(patch: Partial<EmailPresetOverride>) {
    onDesignChange({ presetOverride: { ...presetOverride, ...patch } })
  }

  function handleBgChange(key: 'background' | 'containerBg' | 'footerBg', value: string) {
    if (linkBackgrounds) {
      updateOverride({ background: value, containerBg: value, footerBg: value })
    } else {
      updateOverride({ [key]: value })
    }
  }

  return (
    <div style={{ padding: '16px 14px', borderBottom: '1px solid #262626' }}>
      <h3 style={labelBig}>Direction artistique</h3>

      <Section label="Preset">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {visiblePresets.map((p) => (
            <button
              key={p.id}
              onClick={() => onDesignChange({ presetId: p.id, presetOverride: null })}
              style={{
                padding: 8,
                borderRadius: 8,
                border: presetId === p.id ? '2px solid #E53E3E' : '1px solid #262626',
                background: '#0a0a0a',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                <Swatch color={p.primary} />
                <Swatch color={p.containerBg} />
                <Swatch color={p.footerBg} />
              </div>
              <div style={{ fontSize: 11, color: '#ccc', fontWeight: 600 }}>{p.name}</div>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAll((s) => !s)}
          style={{
            marginTop: 8,
            padding: '6px 0',
            width: '100%',
            fontSize: 11,
            color: '#888',
            background: 'transparent',
            border: '1px solid #262626',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {showAll ? 'Réduire' : `Voir tous (${EMAIL_PRESETS.length})`}
        </button>
      </Section>

      <Section label="Couleur principale">
        <ColorInput value={resolved.primary} onChange={(v) => updateOverride({ primary: v })} />
      </Section>

      <Section
        label="Fonds"
        right={
          <button
            onClick={() => setLinkBackgrounds((l) => !l)}
            title={linkBackgrounds ? 'Désolidariser les fonds' : 'Lier les fonds'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: linkBackgrounds ? '#E53E3E' : '#555',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {linkBackgrounds ? <LinkIcon size={12} /> : <Unlink size={12} />}
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BgRow label="Page" value={resolved.background} onChange={(v) => handleBgChange('background', v)} />
          <BgRow label="Carte" value={resolved.containerBg} onChange={(v) => handleBgChange('containerBg', v)} />
          <BgRow label="Footer" value={resolved.footerBg} onChange={(v) => handleBgChange('footerBg', v)} />
        </div>
      </Section>

      <Section label="Typographie">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => updateOverride({ fontFamily: opt.value })}
              style={{
                padding: '6px 8px',
                fontSize: 11,
                borderRadius: 6,
                border: resolved.fontFamily === opt.value ? '1px solid #E53E3E' : '1px solid #262626',
                background: resolved.fontFamily === opt.value ? 'rgba(229,62,62,0.1)' : '#0a0a0a',
                color: '#ccc',
                cursor: 'pointer',
                fontFamily: opt.value,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Boutons">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
          {BUTTON_SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateOverride({ buttonShape: opt.value })}
              style={{
                padding: '6px 8px',
                fontSize: 11,
                borderRadius: 6,
                border: resolved.buttonShape === opt.value ? '1px solid #E53E3E' : '1px solid #262626',
                background: resolved.buttonShape === opt.value ? 'rgba(229,62,62,0.1)' : '#0a0a0a',
                color: '#ccc',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#ccc' }}>
          <input
            type="checkbox"
            checked={resolved.buttonShadow}
            onChange={(e) => updateOverride({ buttonShadow: e.target.checked })}
          />
          Ombre portée
        </label>
      </Section>
    </div>
  )
}

const labelBig: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 14px',
}

function Section({
  label,
  right,
  children,
}: {
  label: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {right}
      </div>
      {children}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        background: color,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 30, height: 30, border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '6px 8px',
          fontSize: 11,
          background: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: 6,
          color: '#ccc',
          outline: 'none',
          fontFamily: 'monospace',
        }}
      />
    </div>
  )
}

function BgRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#888', width: 48 }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '4px 8px',
          fontSize: 11,
          background: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: 6,
          color: '#ccc',
          outline: 'none',
          fontFamily: 'monospace',
        }}
      />
    </div>
  )
}
