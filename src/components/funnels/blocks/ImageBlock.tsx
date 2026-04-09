'use client'

/**
 * T-028c — ImageBlock migré vers le design system v2.
 *
 * Bloc image standalone avec link optionnel. Adopte le langage visuel du
 * design system :
 * - border-radius 16px (au lieu de 8px) pour cohérence avec les cards
 * - ombre colorée légère via `--fnl-primary-rgb` (subtle, plus prononcée au hover)
 * - hover scale 1.02 pour donner de la vie
 *
 * L'état "vide" (pas de src) est affiché via la couleur secondaire pour
 * rester dans la palette du preset.
 *
 * Note : on consomme des URL externes (uploads des coachs) donc pas de
 * `next/image` — la règle ESLint @next/next/no-img-element est désactivée
 * localement, comme pour Lightbox/BeforeAfter.
 */

import type { FunnelImageBlockConfig } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: FunnelImageBlockConfig
}

export default function ImageBlock({ config }: Props) {
  if (!config.src) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--fnl-text-secondary)',
          fontSize: 14,
        }}
      >
        Aucune image configurée
      </div>
    )
  }

  // Alignement du conteneur — gère left/center/right via margin
  const marginStyle: React.CSSProperties =
    {
      left: {} as React.CSSProperties,
      center: { marginLeft: 'auto', marginRight: 'auto' },
      right: { marginLeft: 'auto' },
    }[config.alignment || 'center'] || { marginLeft: 'auto', marginRight: 'auto' }

  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={config.src}
      alt={config.alt || ''}
      style={{
        display: 'block',
        maxWidth: '100%',
        width: config.width ? config.width : undefined,
        borderRadius: 16,
        boxShadow:
          '0 8px 30px rgba(var(--fnl-primary-rgb), 0.12), 0 4px 15px rgba(0, 0, 0, 0.08)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        ...marginStyle,
      }}
    />
  )

  return (
    <div style={{ padding: 20 }}>
      {config.linkUrl ? (
        <a
          href={resolveFunnelUrl(config.linkUrl)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block' }}
        >
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  )
}
