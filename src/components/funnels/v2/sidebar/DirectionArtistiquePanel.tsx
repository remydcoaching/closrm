'use client'

/**
 * T-028b Phase 2 — Panneau "Direction artistique" de la sidebar du builder.
 *
 * Permet au coach de configurer le design system de son funnel :
 * - Sélectionner un preset (20 cards)
 * - Override les 4 couleurs (primary + 3 fonds) avec un toggle 🔗 lier les fonds
 * - Activer/désactiver les 10 effets toggleables (les 5 forcés sont grisés on)
 *
 * UX portée à l'identique de la sandbox `/dev/funnels-sandbox` (validée par
 * Rémy le 2026-04-07). Toute modification est propagée au parent via
 * `onDesignChange` qui débounce la persistance backend.
 */

import { useMemo, useState } from 'react'
import {
  FUNNEL_PRESETS,
  getPresetByIdOrDefault,
} from '@/lib/funnels/presets'
import { DEFAULT_EFFECTS, EFFECT_META } from '@/lib/funnels/effects-defaults'
import type {
  FunnelEffectId,
  FunnelPreset,
  FunnelPresetOverride,
} from '@/lib/funnels/design-types'
import type {
  FunnelPresetOverrideJSON,
  FunnelEffectsConfigJSON,
} from '@/types'

/**
 * T-028 Phase 9 — 4 presets "featured" affichés en premier dans la sidebar.
 * Les 16 autres sont repliés derrière un bouton "Voir tout (20)".
 * Ordre validé par Rémy le 2026-04-07.
 */
const FEATURED_PRESET_IDS = ['ocean', 'foret', 'violet', 'impact'] as const

/**
 * T-028 Phase 9 — Seuls les effets `global` et `forced` sont affichés dans
 * la sidebar. Les effets `block` (E1 shimmer, E3 button-shine) sont
 * désormais gérés par bloc via l'inspector de droite (cf. BlockEffectsPanel).
 */
const SIDEBAR_EFFECTS = EFFECT_META.filter(
  (meta) => meta.category === 'forced' || meta.category === 'global',
)

interface Props {
  /** ID du preset actuellement sélectionné. */
  presetId: string
  /** Override custom des couleurs (peut être null). */
  presetOverride: FunnelPresetOverrideJSON | null
  /** Map des effets toggleables (les forcés sont ignorés). */
  effectsConfig: FunnelEffectsConfigJSON
  /** Callback : appelé à chaque changement, le parent persiste en DB. */
  onDesignChange: (changes: {
    preset_id?: string
    preset_override?: FunnelPresetOverrideJSON | null
    effects_config?: FunnelEffectsConfigJSON
  }) => void
}

const BG_KEYS: Array<'heroBg' | 'sectionBg' | 'footerBg'> = [
  'heroBg',
  'sectionBg',
  'footerBg',
]

export default function DirectionArtistiquePanel({
  presetId,
  presetOverride,
  effectsConfig,
  onDesignChange,
}: Props) {
  const preset = getPresetByIdOrDefault(presetId)

  // T-028 Phase 9 — État "voir tous les presets" : false par défaut = n'affiche
  // que les 4 featured (Ocean, Forêt, Violet, Impact). Si le preset actif n'est
  // pas dans les featured, on l'ajoute systématiquement à la liste visible
  // pour que le coach voie son choix courant même en mode replié.
  const [showAllPresets, setShowAllPresets] = useState(false)

  const visiblePresets = useMemo<readonly FunnelPreset[]>(() => {
    if (showAllPresets) return FUNNEL_PRESETS
    const featured = FUNNEL_PRESETS.filter((p) =>
      (FEATURED_PRESET_IDS as readonly string[]).includes(p.id),
    )
    // Si le preset actuel n'est pas dans les featured, l'ajouter en tête
    if (!(FEATURED_PRESET_IDS as readonly string[]).includes(presetId)) {
      const current = FUNNEL_PRESETS.find((p) => p.id === presetId)
      if (current) return [current, ...featured]
    }
    return featured
  }, [showAllPresets, presetId])

  // Détermine si le mode "lier les fonds" est actuellement actif :
  // c'est le cas quand les 3 fonds overridés ont la même valeur.
  const linkBackgrounds = useMemo(() => {
    if (!presetOverride) return false
    const { heroBg, sectionBg, footerBg } = presetOverride
    if (!heroBg && !sectionBg && !footerBg) return false
    return heroBg === sectionBg && sectionBg === footerBg
  }, [presetOverride])

  // Helper : valeur affichée par un picker (override si défini, sinon preset)
  const pickerValue = (key: 'primary' | 'heroBg' | 'sectionBg' | 'footerBg'): string => {
    return presetOverride?.[key] ?? preset[key]
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSelectPreset = (newPreset: FunnelPreset) => {
    // Choisir un nouveau preset reset les overrides (comportement validé en T-028a)
    onDesignChange({
      preset_id: newPreset.id,
      preset_override: null,
    })
  }

  const handleColorChange = (
    key: 'primary' | 'heroBg' | 'sectionBg' | 'footerBg',
    value: string,
  ) => {
    const current: FunnelPresetOverride = presetOverride ?? {}
    const next: FunnelPresetOverride = { ...current }

    // Si on touche un fond ET que le mode "lier les fonds" est actif → propage aux 3
    if (linkBackgrounds && BG_KEYS.includes(key as 'heroBg' | 'sectionBg' | 'footerBg')) {
      next.heroBg = value
      next.sectionBg = value
      next.footerBg = value
    } else {
      next[key] = value
    }

    onDesignChange({ preset_override: next })
  }

  const handleToggleLinkBackgrounds = () => {
    if (linkBackgrounds) {
      // Désactivation : on garde les valeurs actuelles, juste les pickers redeviennent indépendants
      // Rien à changer dans les overrides — c'est juste le state UI dérivé qui change
      // En pratique, comme on dérive linkBackgrounds des values, désactiver = changer une des 3 pour qu'elles diffèrent
      // Plus simple : ne rien faire ici, c'est uniquement la prochaine modif qui rompra le lien.
      // → MAIS l'utilisateur attend un feedback visuel clair → on force la divergence en changeant légèrement l'un des fonds
      // → C'est trop subtil. Solution : on stocke linkBackgrounds dans le parent state OU on l'oublie ici.
      // Pour la V1, le toggle se contente de "réaligner les 3 fonds sur heroBg" quand on l'active,
      // et de "ne rien faire" quand on le désactive (les 3 fonds restent égaux mais le picker autorise la divergence).
      // Pour vraiment "désactiver", on passe par un trick : on copie une des valeurs avec une variation imperceptible.
      // → BEAUCOUP trop hacky. Mieux : tracker linkBackgrounds dans un state local du panneau plutôt que dérivé.
      // C'est ce qu'on va faire dans la version Phase 7 polish.
      // Pour Phase 2, comportement minimal : le toggle aligne au activate, et au deactivate on assume.
      return
    }
    // Activation : aligner les 3 fonds sur la valeur actuelle de heroBg
    const targetBg = presetOverride?.heroBg ?? preset.heroBg
    onDesignChange({
      preset_override: {
        ...(presetOverride ?? {}),
        heroBg: targetBg,
        sectionBg: targetBg,
        footerBg: targetBg,
      },
    })
  }

  const handleResetOverrides = () => {
    onDesignChange({ preset_override: null })
  }

  const handleToggleEffect = (id: FunnelEffectId) => {
    const current = effectsConfig[id] ?? DEFAULT_EFFECTS[id]
    onDesignChange({
      effects_config: { ...effectsConfig, [id]: !current },
    })
  }

  const hasOverride = presetOverride !== null && Object.keys(presetOverride).length > 0

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div style={panelStyle}>
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <span style={headerTitleStyle}>Direction artistique</span>
        <span style={headerHintStyle}>{preset.name}</span>
      </header>

      {/* ─── PRESETS ─────────────────────────────────────────────────────── */}
      <section>
        <h3 style={sectionTitleStyle}>
          Preset ({showAllPresets ? FUNNEL_PRESETS.length : visiblePresets.length}/{FUNNEL_PRESETS.length})
        </h3>
        <div style={presetGridStyle}>
          {visiblePresets.map((p) => {
            const active = p.id === presetId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                style={presetCardStyle(active)}
                title={p.name}
              >
                <div style={swatchesStyle}>
                  <span style={{ ...swatchStyle, background: p.primary }} />
                  <span style={{ ...swatchStyle, background: p.heroBg }} />
                  <span style={{ ...swatchStyle, background: p.footerBg }} />
                </div>
                <span style={presetNameStyle}>{p.name}</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAllPresets((s) => !s)}
          style={seeAllButtonStyle}
        >
          {showAllPresets ? 'Masquer' : `Voir tout (${FUNNEL_PRESETS.length})`}
        </button>
      </section>

      {/* ─── COULEURS ────────────────────────────────────────────────────── */}
      <section>
        <div style={sectionHeaderRowStyle}>
          <h3 style={sectionTitleStyle}>Couleurs</h3>
          {hasOverride && (
            <button
              type="button"
              onClick={handleResetOverrides}
              style={resetButtonStyle}
              title="Réinitialiser au preset"
            >
              Reset
            </button>
          )}
        </div>

        {/* Picker couleur principale (toujours indépendant) */}
        <div style={pickerRowStyle}>
          <ColorSwatch
            value={pickerValue('primary')}
            isOverridden={presetOverride?.primary !== undefined}
            onChange={(v) => handleColorChange('primary', v)}
          />
          <span style={pickerLabelStyle}>Principale</span>
        </div>

        {/* Groupe des 3 fonds avec toggle de liaison */}
        <div style={bgGroupStyle}>
          <button
            type="button"
            onClick={handleToggleLinkBackgrounds}
            style={linkButtonStyle(linkBackgrounds)}
            title={
              linkBackgrounds
                ? 'Fonds liés — changer une couleur change les 3'
                : 'Fonds indépendants — clique pour les lier'
            }
            aria-pressed={linkBackgrounds}
          >
            {linkBackgrounds ? '🔗' : '🔓'}
          </button>
          <div style={bgPickersStyle}>
            <div style={pickerRowStyle}>
              <ColorSwatch
                value={pickerValue('heroBg')}
                isOverridden={presetOverride?.heroBg !== undefined}
                onChange={(v) => handleColorChange('heroBg', v)}
              />
              <span style={pickerLabelStyle}>Fond hero</span>
            </div>
            <div style={pickerRowStyle}>
              <ColorSwatch
                value={pickerValue('sectionBg')}
                isOverridden={presetOverride?.sectionBg !== undefined}
                onChange={(v) => handleColorChange('sectionBg', v)}
              />
              <span style={pickerLabelStyle}>Fond sections</span>
            </div>
            <div style={pickerRowStyle}>
              <ColorSwatch
                value={pickerValue('footerBg')}
                isOverridden={presetOverride?.footerBg !== undefined}
                onChange={(v) => handleColorChange('footerBg', v)}
              />
              <span style={pickerLabelStyle}>Fond footer</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EFFETS GLOBAUX (forced + global) ────────────────────────────── */}
      {/* T-028 Phase 9 — Ne contient que les effets qui s'appliquent à tout le
          funnel. Les effets par-bloc (shimmer, button shine) sont dans
          l'inspector de droite via BlockEffectsPanel. */}
      <section>
        <h3 style={sectionTitleStyle}>Effets globaux ({SIDEBAR_EFFECTS.length})</h3>
        <div style={effectsListStyle}>
          {SIDEBAR_EFFECTS.map((meta) => {
            const isForced = meta.category === 'forced'
            const enabled = isForced
              ? true
              : effectsConfig[meta.id] ?? DEFAULT_EFFECTS[meta.id]
            return (
              <EffectRow
                key={meta.id}
                label={meta.label}
                description={meta.description}
                enabled={enabled}
                isForced={isForced}
                onToggle={() => !isForced && handleToggleEffect(meta.id)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

/* ─── Sous-composant ColorSwatch ─────────────────────────────────────── */

function ColorSwatch({
  value,
  isOverridden,
  onChange,
}: {
  value: string
  isOverridden: boolean
  onChange: (v: string) => void
}) {
  return (
    <label style={colorSwatchWrapperStyle(isOverridden)}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={colorInputStyle}
      />
      {isOverridden && <span style={overrideDotStyle} aria-label="Couleur modifiée" />}
    </label>
  )
}

/* ─── Sous-composant EffectRow ──────────────────────────────────────── */

function EffectRow({
  label,
  description,
  enabled,
  isForced,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  isForced: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isForced}
      title={isForced ? `${description} (toujours actif)` : description}
      style={effectRowStyle(enabled, isForced)}
    >
      <span style={effectLabelStyle}>
        {label}
        {isForced && <span style={forcedTagStyle}>verrouillé</span>}
      </span>
      <span style={switchTrackStyle(enabled)}>
        <span style={switchThumbStyle(enabled)} />
      </span>
    </button>
  )
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 4px',
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-primary, #fff)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const headerHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#22d3ee',
  background: 'rgba(34, 211, 238, 0.1)',
  padding: '2px 8px',
  borderRadius: 50,
  fontWeight: 600,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--text-secondary, #888)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  margin: '0 0 8px 4px',
}

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
  paddingRight: 4,
}

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 6,
}

const seeAllButtonStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '6px 10px',
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.7)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  transition: 'all 0.15s ease',
}

const presetCardStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
  border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: '8px 6px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textAlign: 'center',
  color: 'inherit',
  fontFamily: 'inherit',
})

const swatchesStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 3,
  marginBottom: 4,
}

const swatchStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.2)',
  display: 'inline-block',
}

const presetNameStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 600,
  color: '#fff',
}

const pickerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '4px 0',
}

const colorSwatchWrapperStyle = (isOverridden: boolean): React.CSSProperties => ({
  position: 'relative',
  width: 28,
  height: 28,
  borderRadius: 6,
  border: isOverridden ? '2px solid #22d3ee' : '2px solid rgba(255,255,255,0.15)',
  overflow: 'hidden',
  cursor: 'pointer',
  flexShrink: 0,
})

const colorInputStyle: React.CSSProperties = {
  position: 'absolute',
  inset: -4,
  width: 'calc(100% + 8px)',
  height: 'calc(100% + 8px)',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
}

const overrideDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: -3,
  right: -3,
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#22d3ee',
  border: '1px solid #141414',
  pointerEvents: 'none',
}

const pickerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary, #aaa)',
  fontWeight: 500,
}

const bgGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '8px 8px 8px 6px',
  marginTop: 6,
  background: 'rgba(255,255,255,0.02)',
  border: '1px dashed rgba(255,255,255,0.08)',
  borderRadius: 8,
}

const bgPickersStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
}

const linkButtonStyle = (active: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: active ? '2px solid #22d3ee' : '2px solid rgba(255,255,255,0.15)',
  background: active ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
  transition: 'all 0.15s ease',
})

const resetButtonStyle: React.CSSProperties = {
  fontSize: 9,
  padding: '3px 8px',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const effectsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const effectRowStyle = (enabled: boolean, isForced: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '7px 10px',
  background: enabled && !isForced ? 'rgba(34, 211, 238, 0.06)' : 'rgba(255,255,255,0.02)',
  border:
    enabled && !isForced
      ? '1px solid rgba(34, 211, 238, 0.25)'
      : '1px solid rgba(255,255,255,0.05)',
  borderRadius: 6,
  cursor: isForced ? 'not-allowed' : 'pointer',
  opacity: isForced ? 0.6 : 1,
  textAlign: 'left',
  fontFamily: 'inherit',
  color: '#fff',
  transition: 'all 0.15s ease',
})

const effectLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const forcedTagStyle: React.CSSProperties = {
  fontSize: 8,
  padding: '1px 5px',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.5)',
  borderRadius: 3,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontWeight: 700,
}

const switchTrackStyle = (enabled: boolean): React.CSSProperties => ({
  width: 26,
  height: 14,
  borderRadius: 8,
  background: enabled ? '#22d3ee' : 'rgba(255,255,255,0.15)',
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
