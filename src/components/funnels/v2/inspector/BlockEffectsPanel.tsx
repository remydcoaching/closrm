'use client'

/**
 * T-028 Phase 9 — Panneau d'effets "par bloc" affiché dans l'inspector de
 * droite, uniquement quand le bloc sélectionné supporte des effets locaux.
 *
 * Les effets supportés par type :
 * - `hero` : shimmer (sur la portion highlightée du titre) + buttonShine (CTA)
 * - `cta`  : buttonShine
 * - `text` : shimmer
 * - autres : rien — le composant ne s'affiche pas
 *
 * Les modifications sont propagées au parent (inspector) via `onChange`,
 * qui lui-même met à jour `block.config.effects` et persiste via autosave.
 */

import type { FunnelBlock, BlockEffectsJSON } from '@/types'

interface Props {
  block: FunnelBlock
  onChange: (effects: BlockEffectsJSON) => void
}

/**
 * Effets disponibles selon le type de bloc. Chaque entrée = un switch
 * dans l'UI. Les effets inconnus pour un type sont simplement absents.
 */
interface EffectOption {
  key: keyof BlockEffectsJSON
  label: string
  description: string
}

const EFFECTS_BY_TYPE: Partial<Record<FunnelBlock['type'], EffectOption[]>> = {
  hero: [
    {
      key: 'shimmer',
      label: 'Shimmer titre',
      description: 'Animation de brillance sur le titre',
    },
    {
      key: 'buttonShine',
      label: 'Shine bouton',
      description: 'Reflet lumineux qui traverse le bouton',
    },
  ],
  cta: [
    {
      key: 'buttonShine',
      label: 'Shine bouton',
      description: 'Reflet lumineux qui traverse le bouton',
    },
  ],
  text: [
    {
      key: 'shimmer',
      label: 'Shimmer',
      description: 'Animation de brillance sur le texte',
    },
  ],
}

export default function BlockEffectsPanel({ block, onChange }: Props) {
  const availableEffects = EFFECTS_BY_TYPE[block.type]
  if (!availableEffects || availableEffects.length === 0) {
    return null
  }

  const currentEffects = (block.config as { effects?: BlockEffectsJSON }).effects ?? {}

  const handleToggle = (key: keyof BlockEffectsJSON) => {
    const isEnabled = currentEffects[key] === true
    onChange({ ...currentEffects, [key]: !isEnabled })
  }

  return (
    <section style={panelStyle}>
      <h3 style={titleStyle}>Effets du bloc</h3>
      <div style={listStyle}>
        {availableEffects.map((effect) => {
          const enabled = currentEffects[effect.key] === true
          return (
            <button
              key={effect.key}
              type="button"
              onClick={() => handleToggle(effect.key)}
              title={effect.description}
              style={rowStyle(enabled)}
            >
              <span style={labelStyle}>{effect.label}</span>
              <span style={switchTrackStyle(enabled)}>
                <span style={switchThumbStyle(enabled)} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const panelStyle: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: '1px solid rgba(255,255,255,0.06)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--text-secondary, #888)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  margin: '0 0 8px 4px',
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const rowStyle = (enabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '7px 10px',
  background: enabled ? 'rgba(0,200,83, 0.06)' : 'rgba(255,255,255,0.02)',
  border: enabled
    ? '1px solid rgba(0,200,83, 0.25)'
    : '1px solid rgba(255,255,255,0.05)',
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  color: '#fff',
  transition: 'all 0.15s ease',
})

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
}

const switchTrackStyle = (enabled: boolean): React.CSSProperties => ({
  width: 26,
  height: 14,
  borderRadius: 8,
  background: enabled ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
  position: 'relative',
  flexShrink: 0,
  transition: 'background 0.15s ease',
})

const switchThumbStyle = (enabled: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: enabled ? 14 : 2,
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#fff',
  transition: 'left 0.15s ease',
})
