'use client'

/**
 * A-028a — Sélecteur de redirection réutilisable pour les configs de blocs funnel.
 *
 * Permet au coach de choisir une destination :
 * - Un bloc de la page (ancre, stocké comme "#block-{blockId}")
 * - Une page du funnel (stocké comme "page:{slug}")
 * - Une URL personnalisée (stocké tel quel)
 * - Aucune redirection (null ou vide)
 *
 * Utilisé par : HeroConfig, CtaConfig, PricingConfig, ImageConfig, FormConfig.
 */

import type { FunnelPage, FunnelBlock, FunnelBlockType } from '@/types'

interface Props {
  /** Valeur actuelle du champ URL (peut être "#block-{id}", "page:slug", une URL, null ou ''). */
  value: string | null
  /** Callback quand la valeur change. */
  onChange: (value: string | null) => void
  /** Pages du funnel disponibles pour la sélection. */
  pages?: FunnelPage[]
  /** Blocs de la page active — pour l'option "Vers un bloc de la page". */
  blocks?: FunnelBlock[]
  /** Libellé du groupe (défaut: "Redirection"). */
  label?: string
  /** Si true, "Aucune" n'est pas proposé (le champ est obligatoire). */
  required?: boolean
}

/** Labels lisibles pour chaque type de bloc. */
const BLOCK_TYPE_LABELS: Record<FunnelBlockType, string> = {
  hero: 'Hero',
  video: 'Vidéo',
  text: 'Texte',
  image: 'Image',
  cta: 'Bouton CTA',
  pricing: 'Tarification',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  countdown: 'Compte à rebours',
  spacer: 'Espacement',
  footer: 'Footer',
  booking: 'Réservation',
  form: 'Formulaire',
}

export default function RedirectPicker({
  value,
  onChange,
  pages,
  blocks,
  label = 'Redirection',
  required = false,
}: Props) {
  const url = value || ''
  const isAnchor = url.startsWith('#block-')
  const isPageRedirect = url.startsWith('page:')
  const isCustomUrl = url !== '' && !isPageRedirect && !isAnchor

  const mode = url === ''
    ? 'none'
    : isAnchor
    ? 'anchor'
    : isPageRedirect
    ? 'page'
    : 'custom'

  const selectedBlockId = isAnchor ? url.slice(7) : '' // "#block-xxx" → "xxx"
  const selectedPageSlug = isPageRedirect ? url.slice(5) : ''

  function handleModeChange(newMode: string) {
    if (newMode === 'none') {
      onChange(null)
    } else if (newMode === 'anchor') {
      const firstBlock = blocks?.[0]
      onChange(firstBlock ? `#block-${firstBlock.id}` : null)
    } else if (newMode === 'page') {
      const firstPage = pages?.[0]
      onChange(firstPage ? `page:${firstPage.slug}` : null)
    } else {
      onChange('https://')
    }
  }

  return (
    <div style={groupStyle}>
      <div style={headerStyle}>{label}</div>

      <div>
        <label style={labelStyle}>Destination</label>
        <select
          value={mode}
          onChange={e => handleModeChange(e.target.value)}
          style={inputStyle}
        >
          {!required && <option value="none">Aucune</option>}
          {blocks && blocks.length > 0 && (
            <option value="anchor">Bloc de la page</option>
          )}
          {pages && pages.length > 0 && (
            <option value="page">Page du funnel</option>
          )}
          <option value="custom">URL personnalisée</option>
        </select>
      </div>

      {/* Anchor: block selector */}
      {mode === 'anchor' && blocks && blocks.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <label style={labelStyle}>Bloc cible</label>
          <select
            value={selectedBlockId}
            onChange={e => onChange(`#block-${e.target.value}`)}
            style={inputStyle}
          >
            {blocks.map((b, i) => (
              <option key={b.id} value={b.id}>
                {i + 1}. {BLOCK_TYPE_LABELS[b.type] ?? b.type}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Page selector */}
      {mode === 'page' && pages && pages.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <label style={labelStyle}>Page</label>
          <select
            value={selectedPageSlug}
            onChange={e => onChange(`page:${e.target.value}`)}
            style={inputStyle}
          >
            {pages.map(p => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Custom URL */}
      {mode === 'custom' && (
        <div style={{ marginTop: 6 }}>
          <label style={labelStyle}>URL</label>
          <input
            type="url"
            value={isCustomUrl ? url : ''}
            onChange={e => onChange(e.target.value || null)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
      )}
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const groupStyle: React.CSSProperties = {
  marginTop: 8,
  background: '#111',
  borderRadius: 8,
  padding: 10,
  border: '1px solid #262626',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const headerStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#555', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}
