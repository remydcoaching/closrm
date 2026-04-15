'use client'

/**
 * T-028c — CtaBlock migré vers le design system v2.
 *
 * Bouton d'appel à l'action standalone. Utilise désormais la classe `.fnl-btn`
 * du design system qui apporte automatiquement :
 * - gradient `--fnl-primary` → `--fnl-primary-light`
 * - border-radius 50px
 * - typo Poppins 700, 16-18px
 * - ombre colorée via E4 (effet forcé)
 * - shine animé via E3 (toggleable, ON par défaut)
 * - hover translateY(-3px) + ombre amplifiée
 *
 * 3 styles supportés (depuis `config.style`) :
 * - `primary` (défaut) : utilise `.fnl-btn` (gradient plein)
 * - `outline` : variante "ghost" avec border + texte couleur principale
 * - `secondary` : alias visuel de outline pour l'instant (à étendre en T-028b)
 *
 * 3 tailles supportées via une simple modulation de padding/font-size, en
 * surcharge sur `.fnl-btn`.
 */

import type { CtaBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: CtaBlockConfig
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '12px 28px', fontSize: 14 },
  md: { padding: '16px 40px', fontSize: 16 },
  lg: { padding: '20px 50px', fontSize: 18 },
}

const alignMap: Record<string, React.CSSProperties['justifyContent']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

export default function CtaBlock({ config }: Props) {
  const sizeStyle = sizeStyles[config.size] || sizeStyles.md
  const justifyContent = alignMap[config.alignment] || 'center'
  const isOutline = config.style === 'outline' || config.style === 'secondary'

  // Variante outline : on n'utilise PAS .fnl-btn pour éviter d'hériter du
  // gradient + ombre colorée. On reconstruit un style ghost compatible avec
  // les CSS vars du preset.
  if (isOutline) {
    return (
      <div
        style={{
          padding: 20,
          display: 'flex',
          justifyContent,
        }}
      >
        <a
          href={resolveFunnelUrl(config.url)}
          style={{
            ...sizeStyle,
            display: 'inline-block',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            color: 'var(--fnl-primary)',
            background: 'transparent',
            border: '2px solid var(--fnl-primary)',
            borderRadius: 50,
            textDecoration: 'none',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {config.text || 'Cliquez ici'}
        </a>
      </div>
    )
  }

  // Variante primary : utilise .fnl-btn qui apporte tout le style premium
  // (E3 shine + E4 colored shadow + hover translateY)
  return (
    <div
      style={{
        padding: 20,
        display: 'flex',
        justifyContent,
      }}
    >
      <a href={resolveFunnelUrl(config.url)} className="fnl-btn" style={sizeStyle}>
        {config.text || 'Cliquez ici'}
      </a>
    </div>
  )
}
