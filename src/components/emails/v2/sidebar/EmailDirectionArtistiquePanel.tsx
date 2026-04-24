'use client'

/**
 * Panneau Direction artistique — aligné sur le style du builder funnel de Rémi.
 * Chaque preset est rendu comme une micro-preview d'email (pas de 3 dots).
 */

import { useState } from 'react'
import { Link as LinkIcon, Unlink } from 'lucide-react'
import {
  EMAIL_PRESETS,
  FEATURED_EMAIL_PRESET_IDS,
  getEmailPresetByIdOrDefault,
} from '@/lib/email/presets'
import type { EmailPreset, EmailFontFamily, EmailButtonShape, EmailPresetOverride } from '@/lib/email/design-types'

interface Props {
  presetId: string
  presetOverride: EmailPresetOverride | null
  onDesignChange: (changes: {
    presetId?: string
    presetOverride?: EmailPresetOverride | null
  }) => void
}

const FONT_OPTIONS: { label: string; value: EmailFontFamily; preview: string }[] = [
  { label: 'Sans', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", preview: 'Inter' },
  { label: 'Serif', value: "Georgia, 'Times New Roman', serif", preview: 'Georgia' },
  { label: 'Display', value: "'Playfair Display', Georgia, serif", preview: 'Playfair' },
  { label: 'Mono', value: "'JetBrains Mono', 'Courier New', monospace", preview: 'Mono' },
]

const BUTTON_SHAPE_OPTIONS: { label: string; value: EmailButtonShape; radius: number }[] = [
  { label: 'Carré', value: 'sharp', radius: 0 },
  { label: 'Arrondi', value: 'rounded', radius: 8 },
  { label: 'Pilule', value: 'pill', radius: 999 },
]

export default function EmailDirectionArtistiquePanel({
  presetId,
  presetOverride,
  onDesignChange,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const [linkBackgrounds, setLinkBackgrounds] = useState(() => {
    if (!presetOverride) return false
    return (
      !!presetOverride.background &&
      presetOverride.background === presetOverride.containerBg &&
      presetOverride.containerBg === presetOverride.footerBg
    )
  })
  const preset = getEmailPresetByIdOrDefault(presetId)

  const visiblePresets = showAll
    ? EMAIL_PRESETS
    : EMAIL_PRESETS.filter((p) => (FEATURED_EMAIL_PRESET_IDS as readonly string[]).includes(p.id))

  const resolved: EmailPreset = {
    ...preset,
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

  function handleResetOverrides() {
    onDesignChange({ presetOverride: null })
  }

  const hasOverride = presetOverride !== null && Object.keys(presetOverride).length > 0

  return (
    <div style={{ padding: '16px 14px', borderBottom: '1px solid #1f1f1f' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={headerTitle}>Direction artistique</span>
        <span style={headerPill}>{preset.name}</span>
      </header>

      <Section label={`Preset (${visiblePresets.length}/${EMAIL_PRESETS.length})`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {visiblePresets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              active={p.id === presetId}
              onClick={() => onDesignChange({ presetId: p.id, presetOverride: null })}
            />
          ))}
        </div>
        <button onClick={() => setShowAll((s) => !s)} style={linkButton}>
          {showAll ? 'Réduire' : `Voir tous (${EMAIL_PRESETS.length})`}
        </button>
      </Section>

      <Section
        label="Couleurs"
        right={
          hasOverride ? (
            <button onClick={handleResetOverrides} style={resetBtn}>
              Reset
            </button>
          ) : null
        }
      >
        <div style={pickerRow}>
          <ColorSwatch
            value={resolved.primary}
            overridden={presetOverride?.primary !== undefined}
            onChange={(v) => updateOverride({ primary: v })}
          />
          <span style={pickerLabel}>Principale</span>
        </div>

        <div style={bgGroup}>
          <button
            onClick={() => setLinkBackgrounds((l) => !l)}
            title={linkBackgrounds ? 'Fonds liés' : 'Fonds indépendants'}
            style={linkToggleBtn(linkBackgrounds)}
            aria-pressed={linkBackgrounds}
          >
            {linkBackgrounds ? <LinkIcon size={12} /> : <Unlink size={12} />}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={pickerRow}>
              <ColorSwatch
                value={resolved.background}
                overridden={presetOverride?.background !== undefined}
                onChange={(v) => handleBgChange('background', v)}
              />
              <span style={pickerLabel}>Page</span>
            </div>
            <div style={pickerRow}>
              <ColorSwatch
                value={resolved.containerBg}
                overridden={presetOverride?.containerBg !== undefined}
                onChange={(v) => handleBgChange('containerBg', v)}
              />
              <span style={pickerLabel}>Carte</span>
            </div>
            <div style={pickerRow}>
              <ColorSwatch
                value={resolved.footerBg}
                overridden={presetOverride?.footerBg !== undefined}
                onChange={(v) => handleBgChange('footerBg', v)}
              />
              <span style={pickerLabel}>Footer</span>
            </div>
          </div>
        </div>
      </Section>

      <Section label="Typographie">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {FONT_OPTIONS.map((opt) => {
            const active = resolved.fontFamily === opt.value
            return (
              <button
                key={opt.label}
                onClick={() => updateOverride({ fontFamily: opt.value })}
                style={{
                  padding: '10px 8px',
                  borderRadius: 8,
                  border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: opt.value,
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1 }}>Aa</div>
                <div style={{ fontSize: 9, marginTop: 4, opacity: 0.55, letterSpacing: 0.3 }}>
                  {opt.label}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section label="Boutons">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
          {BUTTON_SHAPE_OPTIONS.map((opt) => {
            const active = resolved.buttonShape === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => updateOverride({ buttonShape: opt.value })}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 34,
                    height: 14,
                    borderRadius: Math.min(opt.radius, 7),
                    background: resolved.primary,
                  }}
                />
                <span style={{ fontSize: 9, opacity: 0.65, letterSpacing: 0.3 }}>{opt.label}</span>
              </button>
            )
          })}
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: '#ccc',
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          <span>Ombre portée</span>
          <span style={switchTrack(resolved.buttonShadow)}>
            <span style={switchThumb(resolved.buttonShadow)} />
          </span>
          <input
            type="checkbox"
            checked={resolved.buttonShadow}
            onChange={(e) => updateOverride({ buttonShadow: e.target.checked })}
            style={{ display: 'none' }}
          />
        </label>
      </Section>
    </div>
  )
}

/* ─── PresetCard: mini email mockup ──────────────────────────────────── */

function PresetCard({
  preset,
  active,
  onClick,
}: {
  preset: EmailPreset
  active: boolean
  onClick: () => void
}) {
  const radius =
    preset.buttonShape === 'sharp' ? 0 : preset.buttonShape === 'pill' ? 999 : 4
  return (
    <button
      onClick={onClick}
      title={preset.name}
      style={{
        padding: 8,
        borderRadius: 10,
        border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.06)',
        background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Mini email preview */}
      <div
        style={{
          background: preset.background,
          borderRadius: 6,
          padding: 6,
          border: '1px solid rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            background: preset.containerBg,
            borderRadius: 3,
            padding: '6px 7px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {/* Heading line */}
          <div
            style={{
              height: 5,
              width: '75%',
              background: preset.textColor,
              borderRadius: 1,
            }}
          />
          {/* Body lines */}
          <div style={{ height: 2, width: '100%', background: preset.mutedColor, borderRadius: 1, opacity: 0.55 }} />
          <div style={{ height: 2, width: '85%', background: preset.mutedColor, borderRadius: 1, opacity: 0.55 }} />
          {/* Button */}
          <div
            style={{
              marginTop: 2,
              height: 8,
              width: 36,
              background: preset.primary,
              borderRadius: Math.min(radius, 4),
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{preset.name}</span>
        {preset.style === 'dark' && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              padding: '1px 5px',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: 3,
              letterSpacing: 0.3,
            }}
          >
            DARK
          </span>
        )}
      </div>
    </button>
  )
}

/* ─── ColorSwatch ────────────────────────────────────────────────────── */

function ColorSwatch({
  value,
  overridden,
  onChange,
}: {
  value: string
  overridden: boolean
  onChange: (v: string) => void
}) {
  return (
    <label
      style={{
        position: 'relative',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: overridden ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
        background: value,
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: -4,
          width: 'calc(100% + 8px)',
          height: 'calc(100% + 8px)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          opacity: 0,
        }}
      />
    </label>
  )
}

/* ─── Section wrapper ────────────────────────────────────────────────── */

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
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          paddingLeft: 2,
        }}
      >
        <span style={sectionTitle}>{label}</span>
        {right}
      </div>
      {children}
    </section>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const headerTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const headerPill: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 50,
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const linkButton: React.CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '7px 10px',
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.7)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const resetBtn: React.CSSProperties = {
  fontSize: 9,
  padding: '3px 8px',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const pickerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '4px 0',
}

const pickerLabel: React.CSSProperties = {
  fontSize: 11,
  color: '#aaa',
  fontWeight: 500,
}

const bgGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '8px 8px 8px 6px',
  marginTop: 6,
  background: 'rgba(255,255,255,0.02)',
  border: '1px dashed rgba(255,255,255,0.08)',
  borderRadius: 8,
}

const linkToggleBtn = (active: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: active ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)',
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
})

const switchTrack = (enabled: boolean): React.CSSProperties => ({
  width: 26,
  height: 14,
  borderRadius: 8,
  background: enabled ? '#fff' : 'rgba(255,255,255,0.15)',
  position: 'relative',
  flexShrink: 0,
  transition: 'background 0.15s ease',
})

const switchThumb = (enabled: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: enabled ? 14 : 2,
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: enabled ? '#0a0a0a' : '#fff',
  transition: 'left 0.15s ease',
})
