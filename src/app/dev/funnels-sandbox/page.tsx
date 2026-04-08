'use client'

/**
 * T-028a — Sandbox de la direction artistique des Funnels v2.
 *
 * Page de dev (non listée dans la nav admin) qui sert à :
 * 1. Tester visuellement chaque preset (20 au total)
 * 2. Override la couleur principale en live via color picker
 * 3. Voir les effets forcés (E4 ombre colorée, E5 badge pulse, E6 lightbox)
 *    appliqués sur des composants de démo
 *
 * Cette sandbox sera enrichie au fil des phases T-028a :
 * - Phase 5 : ajouter les toggles d'effets ON par défaut (E1, E2, E3, E7, E8, E12, E15)
 * - Phase 6 : ajouter les toggles OFF par défaut (E9, E10, E11, E13, E14)
 * - Phase 7 : matrice "tous les presets côte à côte"
 *
 * Accessible uniquement en dev via http://localhost:3000/dev/funnels-sandbox
 * (à protéger derrière un check NODE_ENV en production si on garde la route)
 */

import { useState } from 'react'
import Link from 'next/link'

import {
  FUNNEL_PRESETS,
  DEFAULT_PRESET_ID,
  getPresetByIdOrDefault,
} from '@/lib/funnels/presets'
import { getPresetCssVars } from '@/lib/funnels/apply-preset'
import { DEFAULT_EFFECTS, EFFECT_META } from '@/lib/funnels/effects-defaults'
import type { FunnelPreset, FunnelEffectId } from '@/lib/funnels/design-types'
import { TOGGLEABLE_EFFECTS, FORCED_EFFECTS } from '@/lib/funnels/design-types'
import { Lightbox, useLightbox } from '@/components/funnels/v2/Lightbox'
import { CountUp } from '@/components/funnels/v2/CountUp'
import { Reveal } from '@/components/funnels/v2/Reveal'
import { Countdown } from '@/components/funnels/v2/Countdown'
import { BeforeAfter } from '@/components/funnels/v2/BeforeAfter'
import { useParallax } from '@/components/funnels/v2/use-parallax'
import { useCursorGlow } from '@/components/funnels/v2/use-cursor-glow'

import '@/styles/funnels/tokens.css'
import '@/styles/funnels/base.css'
// Effets forcés
import '@/styles/funnels/effects/e4-colored-shadow.css'
import '@/styles/funnels/effects/e5-badge-pulse.css'
import '@/styles/funnels/effects/e6-lightbox.css'
// Effets toggleables ON par défaut (Phase 5)
import '@/styles/funnels/effects/e1-shimmer.css'
import '@/styles/funnels/effects/e2-hero-glow.css'
import '@/styles/funnels/effects/e3-button-shine.css'
import '@/styles/funnels/effects/e7-count-up.css'
import '@/styles/funnels/effects/e8-reveal-scroll.css'
import '@/styles/funnels/effects/e12-noise.css'
import '@/styles/funnels/effects/e15-sticky-cta.css'
// Effets toggleables OFF par défaut (Phase 6)
import '@/styles/funnels/effects/e9-marquee.css'
import '@/styles/funnels/effects/e10-countdown.css'
import '@/styles/funnels/effects/e11-before-after.css'
import '@/styles/funnels/effects/e13-parallax.css'
import '@/styles/funnels/effects/e14-cursor-glow.css'

// Génération des images "avant/après" en SVG inline (pas de requête réseau)
const BEFORE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="%23475569"/>
    <text x="300" y="210" font-family="sans-serif" font-size="64" font-weight="900" fill="white" text-anchor="middle" opacity="0.4">AVANT</text>
  </svg>`
)}`
const AFTER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="%2310b981"/>
        <stop offset="1" stop-color="%2306b6d4"/>
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(%23ag)"/>
    <text x="300" y="210" font-family="sans-serif" font-size="64" font-weight="900" fill="white" text-anchor="middle">APRÈS</text>
  </svg>`
)}`

// Image de démo pour la lightbox (data URI = pas de requête réseau, fonctionne offline)
const DEMO_TESTIMONIAL_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="%23667eea"/>
        <stop offset="1" stop-color="%23764ba2"/>
      </linearGradient>
    </defs>
    <rect width="400" height="500" fill="url(%23g)"/>
    <text x="200" y="240" font-family="sans-serif" font-size="32" font-weight="700" fill="white" text-anchor="middle">Sarah</text>
    <text x="200" y="290" font-family="sans-serif" font-size="48" font-weight="800" fill="white" text-anchor="middle">−15 kg</text>
    <text x="200" y="330" font-family="sans-serif" font-size="18" fill="white" opacity="0.85" text-anchor="middle">en 3 mois</text>
  </svg>`
)}`

type OverrideKey = 'primary' | 'heroBg' | 'sectionBg' | 'footerBg'
type OverrideState = Partial<Record<OverrideKey, string>>

const BG_KEYS: OverrideKey[] = ['heroBg', 'sectionBg', 'footerBg']

export default function FunnelsSandboxPage() {
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESET_ID)
  const [overrides, setOverrides] = useState<OverrideState>({})
  // Mode "lier les fonds" : quand activé, modifier n'importe quel fond
  // (hero / section / footer) propage la valeur aux 3.
  // Default OFF pour préserver le comportement par preset (3 fonds distincts).
  const [linkBackgrounds, setLinkBackgrounds] = useState<boolean>(false)
  // État des effets toggleables — initialisé depuis les defaults
  const [effects, setEffects] = useState<Record<FunnelEffectId, boolean>>(
    () => ({ ...DEFAULT_EFFECTS })
  )
  const lightbox = useLightbox()

  const preset = getPresetByIdOrDefault(selectedId)
  const hasAnyOverride = Object.keys(overrides).length > 0
  const cssVars = getPresetCssVars(preset, overrides) as React.CSSProperties

  // Construction de la liste de classes fx-* à appliquer sur .fnl-root
  // Les effets forcés sont systématiquement présents.
  const fxClasses = [
    ...FORCED_EFFECTS.map((id) => `fx-${id}`),
    ...TOGGLEABLE_EFFECTS.filter((id) => effects[id]).map((id) => `fx-${id}`),
  ].join(' ')

  const toggleEffect = (id: FunnelEffectId) => {
    setEffects((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const resetEffects = () => setEffects({ ...DEFAULT_EFFECTS })

  // Hooks pour les effets dynamiques (E13 parallax sur hero, E14 cursor glow sur hero)
  const parallaxRef = useParallax<HTMLElement>({
    enabled: effects['e13-parallax'],
  })
  const cursorGlowRef = useCursorGlow<HTMLElement>({
    enabled: effects['e14-cursor-glow'],
  })

  // Combine les 2 refs sur le même élément hero (utility minimale, pas de lib)
  const heroRef = (el: HTMLElement | null) => {
    parallaxRef.current = el
    cursorGlowRef.current = el
  }

  const setOverride = (key: OverrideKey, value: string) => {
    setOverrides((prev) => {
      // Si on touche à un fond ET que le lien est actif, on propage aux 3 fonds.
      if (linkBackgrounds && BG_KEYS.includes(key)) {
        return { ...prev, heroBg: value, sectionBg: value, footerBg: value }
      }
      return { ...prev, [key]: value }
    })
  }
  const resetOverrides = () => setOverrides({})

  // Quand on active le lien : on aligne immédiatement les 3 fonds sur la valeur
  // actuelle du heroBg (override si défini, sinon valeur du preset). Ça évite
  // qu'activer le toggle "ne fasse rien" tant qu'on n'a pas re-cliqué un picker.
  const toggleLinkBackgrounds = () => {
    setLinkBackgrounds((wasLinked) => {
      const willBeLinked = !wasLinked
      if (willBeLinked) {
        const target = overrides.heroBg ?? preset.heroBg
        setOverrides((prev) => ({
          ...prev,
          heroBg: target,
          sectionBg: target,
          footerBg: target,
        }))
      }
      return willBeLinked
    })
  }

  // Helper : valeur affichée par un color picker (override si défini, sinon valeur du preset)
  const pickerValue = (key: OverrideKey): string => overrides[key] ?? preset[key]

  return (
    <div style={pageStyle}>
      {/* ─── HEADER ÉDITEUR (admin chrome) ─────────────────────── */}
      <header style={headerStyle}>
        <div>
          <h1 style={headerTitleStyle}>T-028a — Sandbox Direction Artistique Funnels</h1>
          <p style={headerSubtitleStyle}>
            Sélectionne un preset, override la couleur principale, observe le rendu en
            live. Effets actifs : E4 (ombre colorée), E5 (badge pulse), E6 (lightbox).
          </p>
        </div>
        <Link href="/" style={backLinkStyle}>
          ← retour
        </Link>
      </header>

      {/* ─── BARRE DE PRESETS ──────────────────────────────────── */}
      <section style={presetBarStyle}>
        <div style={presetBarHeaderStyle}>
          <h2 style={presetBarTitleStyle}>20 presets</h2>
          <div style={overrideRowStyle}>
            <span style={overrideLabelStyle}>Override couleurs :</span>
            <ColorPickerWithLabel
              label="Principale"
              value={pickerValue('primary')}
              isOverridden={overrides.primary !== undefined}
              onChange={(v) => setOverride('primary', v)}
            />
            <div style={bgGroupStyle}>
              <button
                type="button"
                onClick={toggleLinkBackgrounds}
                style={linkButtonStyle(linkBackgrounds)}
                title={
                  linkBackgrounds
                    ? 'Fonds liés — changer une couleur change les 3'
                    : 'Fonds indépendants — chaque couleur se modifie séparément'
                }
                aria-pressed={linkBackgrounds}
              >
                {linkBackgrounds ? '🔗' : '🔓'}
              </button>
              <ColorPickerWithLabel
                label="Fond hero"
                value={pickerValue('heroBg')}
                isOverridden={overrides.heroBg !== undefined}
                onChange={(v) => setOverride('heroBg', v)}
              />
              <ColorPickerWithLabel
                label="Fond sections"
                value={pickerValue('sectionBg')}
                isOverridden={overrides.sectionBg !== undefined}
                onChange={(v) => setOverride('sectionBg', v)}
              />
              <ColorPickerWithLabel
                label="Fond footer"
                value={pickerValue('footerBg')}
                isOverridden={overrides.footerBg !== undefined}
                onChange={(v) => setOverride('footerBg', v)}
              />
            </div>
            {hasAnyOverride && (
              <button type="button" onClick={resetOverrides} style={resetButtonStyle}>
                Reset all
              </button>
            )}
          </div>
        </div>
        <div style={presetGridStyle}>
          {FUNNEL_PRESETS.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              active={p.id === selectedId}
              onClick={() => {
                setSelectedId(p.id)
                resetOverrides()
              }}
            />
          ))}
        </div>
      </section>

      {/* ─── PANNEAU EFFETS ─────────────────────────────────────── */}
      <section style={effectsBarStyle}>
        <div style={effectsHeaderStyle}>
          <h2 style={presetBarTitleStyle}>Effets visuels (15)</h2>
          <button type="button" onClick={resetEffects} style={resetButtonStyle}>
            Reset effets
          </button>
        </div>
        <div style={effectsGridStyle}>
          {EFFECT_META.map((meta) => {
            const isForced = meta.category === 'forced'
            // Tous les effets sont maintenant implémentés (Phase 6 livrée)
            const enabled = isForced ? true : effects[meta.id]
            return (
              <EffectToggle
                key={meta.id}
                id={meta.id}
                label={meta.label}
                description={meta.description}
                enabled={enabled}
                isForced={isForced}
                isImplemented
                onToggle={() => !isForced && toggleEffect(meta.id)}
              />
            )
          })}
        </div>
      </section>

      {/* ─── PREVIEW : conteneur .fnl-root avec CSS vars + classes fx-* ─ */}
      <main className={`fnl-root ${fxClasses}`} style={cssVars}>
        {/* HERO — utilise .fnl-hero pour que E2 (glow) puisse s'attacher via ::before/::after */}
        {/* heroRef branche les hooks E13 (parallax) + E14 (cursor glow) */}
        <section className="fnl-hero" ref={heroRef}>
          <div className="fnl-hero-inner">
            {/* Badge pulsant (E5 forcé) */}
            <div className="fnl-badge">
              <span className="fnl-badge-dot"></span>
              <span className="fnl-badge-text">Atelier 100% gratuit</span>
            </div>

            {/* Headline avec span shimmer (E1) sur la portion mise en avant */}
            <h1 className="fnl-headline">
              Découvre comment{' '}
              <span className="fnl-shimmer">atteindre tes objectifs</span>
              <br />
              sans sacrifier ta vie perso en 90 jours
            </h1>
            <p className="fnl-hook">Pour ne plus jamais subir l&apos;effet yoyo.</p>

            {/* Bouton avec ombre colorée (E4) + shine (E3) */}
            <a href="#" className="fnl-btn" onClick={(e) => e.preventDefault()}>
              Réserve ton bilan offert
            </a>
          </div>
        </section>

        {/* SECTION COMPTEURS — démo de E7 count-up + E8 reveal */}
        <section className="fnl-section">
          <div className="fnl-section-inner">
            <Reveal enabled={effects['e8-reveal-scroll']}>
              <div className="fnl-badge" style={{ marginBottom: 24 }}>
                <span className="fnl-badge-text">Nos résultats</span>
              </div>
              <h2 style={{ ...testimonialsTitleStyle, color: 'var(--fnl-primary)' }}>
                Plus que des promesses
              </h2>
              <p style={{ marginBottom: 40, color: 'var(--fnl-text-secondary)' }}>
                Scroll → les chiffres s&apos;animent (E7) et les blocs apparaissent (E8)
              </p>
            </Reveal>

            <div style={countersGridStyle}>
              <Reveal enabled={effects['e8-reveal-scroll']} delay={0}>
                <div>
                  <CountUp target={150} prefix="+" enabled={effects['e7-count-up']} />
                  <span className="fnl-count-up-label">clients accompagnés</span>
                </div>
              </Reveal>
              <Reveal enabled={effects['e8-reveal-scroll']} delay={150}>
                <div>
                  <CountUp target={92} suffix="%" enabled={effects['e7-count-up']} />
                  <span className="fnl-count-up-label">de satisfaction</span>
                </div>
              </Reveal>
              <Reveal enabled={effects['e8-reveal-scroll']} delay={300}>
                <div>
                  <CountUp target={48} enabled={effects['e7-count-up']} />
                  <span className="fnl-count-up-label">heures de coaching/mois</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* SECTION TÉMOIGNAGES — démo de E6 lightbox + cards en reveal */}
        <section className="fnl-section">
          <div className="fnl-section-inner">
            <Reveal enabled={effects['e8-reveal-scroll']}>
              <div className="fnl-badge" style={{ marginBottom: 16 }}>
                <span className="fnl-badge-text">Résultat client</span>
              </div>
              <h2 style={{ ...testimonialsTitleStyle, color: 'var(--fnl-primary)' }}>
                Ils ont transformé leur vie
              </h2>
              <p style={{ marginBottom: 32, color: 'var(--fnl-text-secondary)' }}>
                Clique sur une carte pour ouvrir la lightbox.
              </p>
            </Reveal>

            <div style={testimonialsGridStyle}>
              {[1, 2, 3].map((i, idx) => (
                <Reveal
                  key={i}
                  enabled={effects['e8-reveal-scroll']}
                  delay={idx * 150}
                >
                  <div
                    className="fnl-card-shadow fnl-lightbox-trigger"
                    style={testimonialCardStyle}
                    onClick={() => lightbox.open(DEMO_TESTIMONIAL_SVG)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        lightbox.open(DEMO_TESTIMONIAL_SVG)
                      }
                    }}
                  >
                    <div style={testimonialCardInnerStyle}>
                      Témoignage #{i}
                      <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
                        Cliquer pour agrandir
                      </small>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION COUNTDOWN — démo de E10 */}
        <section className="fnl-section">
          <div className="fnl-section-inner">
            <Reveal enabled={effects['e8-reveal-scroll']}>
              <h2 style={{ ...testimonialsTitleStyle, color: 'var(--fnl-primary)' }}>
                Compte à rebours (E10)
              </h2>
              <p style={{ marginBottom: 24, color: 'var(--fnl-text-secondary)' }}>
                Active le toggle <code>e10-countdown</code> pour le voir.
              </p>
            </Reveal>
            {/* Cible : 2 jours, 13 heures, 24 minutes dans le futur */}
            <Countdown target={2 * 86400 + 13 * 3600 + 24 * 60} />
          </div>
        </section>

        {/* SECTION BEFORE/AFTER — démo de E11 */}
        <section className="fnl-section">
          <div className="fnl-section-inner">
            <Reveal enabled={effects['e8-reveal-scroll']}>
              <h2 style={{ ...testimonialsTitleStyle, color: 'var(--fnl-primary)' }}>
                Avant / Après (E11)
              </h2>
              <p style={{ marginBottom: 24, color: 'var(--fnl-text-secondary)' }}>
                Active le toggle <code>e11-before-after</code>, puis drag le slider.
              </p>
            </Reveal>
            <BeforeAfter beforeUrl={BEFORE_SVG} afterUrl={AFTER_SVG} />
          </div>
        </section>

        {/* SECTION MARQUEE LOGOS — démo de E9 */}
        <section className="fnl-section">
          <div className="fnl-section-inner">
            <Reveal enabled={effects['e8-reveal-scroll']}>
              <h2 style={{ ...testimonialsTitleStyle, color: 'var(--fnl-primary)' }}>
                Bandeau logos défilant (E9)
              </h2>
              <p style={{ marginBottom: 24, color: 'var(--fnl-text-secondary)' }}>
                Active le toggle <code>e9-marquee</code>. Hover pour mettre en pause.
              </p>
            </Reveal>
            <div className="fnl-marquee">
              <div className="fnl-marquee-track">
                {/* Le track contient 2x les mêmes items pour une boucle seamless */}
                {[...Array(2)].flatMap((_, dup) =>
                  ['NIKE', 'APPLE', 'GOOGLE', 'AMAZON', 'TESLA', 'NETFLIX', 'SPOTIFY', 'META'].map(
                    (name) => (
                      <div key={`${dup}-${name}`} className="fnl-marquee-item">
                        {name}
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="fnl-footer">
          <p style={{ color: 'var(--fnl-primary)', fontWeight: 700, marginBottom: 8 }}>
            ClosRM™
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            Preset actif : <strong>{preset.name}</strong> ({preset.id}) — style {preset.style}
            {hasAnyOverride && (
              <>
                {' · '}overrides :{' '}
                {(Object.keys(overrides) as OverrideKey[]).map((k) => (
                  <code
                    key={k}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      marginRight: 6,
                    }}
                  >
                    {k}={overrides[k]}
                  </code>
                ))}
              </>
            )}
          </p>
        </footer>

        {/* Sticky CTA mobile (E15) — visible uniquement sur mobile + effet activé */}
        <div className="fnl-sticky-cta">
          <a href="#" className="fnl-btn" onClick={(e) => e.preventDefault()}>
            Réserve ton bilan
          </a>
        </div>
      </main>

      {/* Lightbox modal (rendu en dehors du .fnl-root pour rester au-dessus de tout) */}
      <Lightbox imageUrl={lightbox.imageUrl} onClose={lightbox.close} alt="Témoignage" />
    </div>
  )
}

/* ─── Sous-composant EffectToggle ──────────────────────────── */

function EffectToggle({
  id,
  label,
  description,
  enabled,
  isForced,
  isImplemented,
  onToggle,
}: {
  id: FunnelEffectId
  label: string
  description: string
  enabled: boolean
  isForced: boolean
  isImplemented: boolean
  onToggle: () => void
}) {
  const opacity = isImplemented ? 1 : 0.4
  const cursor = isForced ? 'not-allowed' : isImplemented ? 'pointer' : 'not-allowed'
  const borderColor = isForced
    ? 'rgba(34, 211, 238, 0.4)'
    : enabled && isImplemented
    ? '#22d3ee'
    : 'rgba(255,255,255,0.1)'

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isForced || !isImplemented}
      title={
        isForced
          ? `${description} (forcé — toujours actif)`
          : !isImplemented
          ? `${description} (pas encore implémenté — Phase 6)`
          : description
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: enabled && isImplemented ? 'rgba(34, 211, 238, 0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        cursor,
        opacity,
        textAlign: 'left',
        fontFamily: 'inherit',
        color: '#fff',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Switch visuel */}
      <span
        style={{
          width: 28,
          height: 16,
          borderRadius: 8,
          background: enabled && isImplemented ? '#22d3ee' : 'rgba(255,255,255,0.15)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: enabled && isImplemented ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s ease',
          }}
        />
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
          {label}
          {isForced && (
            <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 6 }}>(forcé)</span>
          )}
        </span>
        <span
          style={{
            fontSize: 9,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {id}
        </span>
      </div>
    </button>
  )
}

/* ─── Sous-composant ColorPickerWithLabel ──────────────────── */

function ColorPickerWithLabel({
  label,
  value,
  isOverridden,
  onChange,
}: {
  label: string
  value: string
  isOverridden: boolean
  onChange: (v: string) => void
}) {
  return (
    <label style={pickerWrapperStyle} title={label}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={colorPickerStyle}
      />
      <span
        style={{
          ...pickerLabelStyle,
          color: isOverridden ? '#fff' : '#888',
          fontWeight: isOverridden ? 700 : 500,
        }}
      >
        {label}
        {isOverridden && <span style={overrideDotStyle} />}
      </span>
    </label>
  )
}

/* ─── Sous-composant PresetCard ────────────────────────────── */

function PresetCard({
  preset,
  active,
  onClick,
}: {
  preset: FunnelPreset
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={presetCardStyle(active)}>
      <div style={swatchesStyle}>
        <span style={{ ...swatchStyle, background: preset.primary }} />
        <span style={{ ...swatchStyle, background: preset.heroBg }} />
        <span style={{ ...swatchStyle, background: preset.footerBg }} />
      </div>
      <span style={presetNameStyle}>{preset.name}</span>
    </button>
  )
}

/* ─── Styles inline du chrome admin (PAS scopés .fnl-root) ─── */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0a',
  color: '#fff',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 24,
  padding: '20px 24px',
  background: '#141414',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const headerTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
  marginBottom: 4,
}

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#a0a0a0',
  margin: 0,
  maxWidth: 700,
}

const backLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#a0a0a0',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const presetBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: 'rgba(10,10,10,0.95)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: '16px 24px',
}

const presetBarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
  flexWrap: 'wrap',
  gap: 12,
}

const presetBarTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  opacity: 0.7,
  margin: 0,
}

const overrideRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const overrideLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#a0a0a0',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const pickerWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
}

const colorPickerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '2px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  cursor: 'pointer',
  background: 'transparent',
  padding: 0,
}

const pickerLabelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
}

const overrideDotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: '#22d3ee',
}

const bgGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px dashed rgba(255,255,255,0.1)',
  borderRadius: 10,
}

const linkButtonStyle = (active: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  border: active
    ? '2px solid #22d3ee'
    : '2px solid rgba(255,255,255,0.15)',
  background: active ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  padding: 0,
})

const resetButtonStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '6px 12px',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
}

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: 8,
}

const presetCardStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
  border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 6px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  textAlign: 'center',
  color: 'inherit',
  fontFamily: 'inherit',
  boxShadow: active ? '0 4px 20px rgba(255,255,255,0.1)' : 'none',
})

const swatchesStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 3,
  marginBottom: 6,
}

const swatchStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.2)',
  display: 'inline-block',
}

const presetNameStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  color: '#fff',
}

/* ─── Styles inline du panneau effets (PAS scopés .fnl-root) ─── */

const effectsBarStyle: React.CSSProperties = {
  background: '#0e0e0e',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: '16px 24px',
}

const effectsHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
}

const effectsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 8,
}

/* ─── Styles inline du PREVIEW (utilisent les CSS vars --fnl-*) ─── */

const testimonialsTitleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  marginBottom: 12,
  lineHeight: 1.3,
}

const testimonialsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 25,
  maxWidth: 1000,
  margin: '0 auto',
}

const testimonialCardStyle: React.CSSProperties = {
  borderRadius: 20,
  overflow: 'hidden',
  aspectRatio: '4 / 5',
  background:
    'linear-gradient(135deg, rgba(var(--fnl-primary-rgb), 0.15) 0%, rgba(var(--fnl-primary-rgb), 0.05) 100%)',
  border: '2px solid rgba(var(--fnl-primary-rgb), 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--fnl-text)',
  fontWeight: 600,
}

const testimonialCardInnerStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 16,
  padding: 16,
}

const countersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 32,
  maxWidth: 800,
  margin: '0 auto',
  textAlign: 'center',
}
