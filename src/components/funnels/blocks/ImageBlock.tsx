'use client'

/**
 * T-028c — ImageBlock migré vers le design system v2.
 *
 * Bloc image standalone avec link optionnel. Supporte aussi une galerie
 * multi-images avec taille préréglée (small/medium/large/full) et 1-3
 * colonnes, comme la grille des témoignages.
 *
 * Backward-compat : si `images` n'est pas renseigné, on retombe sur le
 * mode legacy `src/alt/width/linkUrl` (1 image, largeur libre).
 */

import type { FunnelImageBlockConfig, FunnelImageItem } from '@/types'
import { resolveFunnelUrl } from '@/lib/funnels/resolve-url'

interface Props {
  config: FunnelImageBlockConfig
}

const SIZE_TO_MAXWIDTH: Record<NonNullable<FunnelImageBlockConfig['size']>, number | null> = {
  small: 240,
  medium: 420,
  large: 640,
  full: null,
}

function renderImage(item: FunnelImageItem, maxWidth: number | null) {
  const img = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={item.src}
      alt={item.alt || ''}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        borderRadius: 16,
        boxShadow:
          '0 8px 30px rgba(var(--fnl-primary-rgb), 0.12), 0 4px 15px rgba(0, 0, 0, 0.08)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      }}
    />
  )

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: maxWidth ?? undefined,
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  if (item.linkUrl) {
    return (
      <a
        href={resolveFunnelUrl(item.linkUrl)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', ...wrapperStyle }}
      >
        {img}
      </a>
    )
  }
  return <div style={wrapperStyle}>{img}</div>
}

export default function ImageBlock({ config }: Props) {
  const hasMulti = Array.isArray(config.images) && config.images.length > 0
  const items: FunnelImageItem[] = hasMulti
    ? (config.images as FunnelImageItem[]).filter((i) => i.src)
    : config.src
    ? [{ src: config.src, alt: config.alt || '', linkUrl: config.linkUrl ?? null }]
    : []

  if (items.length === 0) {
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

  // En mode multi : on respecte `size` + `columns`. En mode legacy (1 image
  // via `src`), on garde `width` numérique pour ne pas casser les funnels
  // déjà publiés qui dépendent de cette largeur précise.
  const size = config.size ?? 'large'
  const columns = config.columns ?? (items.length >= 2 ? 2 : 1)
  const maxItemWidth = SIZE_TO_MAXWIDTH[size]

  const alignment = config.alignment || 'center'
  const justifyContent =
    alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center'

  // Mode legacy 1 image avec largeur custom : on garde l'ancien rendu pour
  // que les pages déjà en ligne ne changent pas de mise en page.
  if (!hasMulti && config.width) {
    const marginStyle: React.CSSProperties =
      {
        left: {} as React.CSSProperties,
        center: { marginLeft: 'auto', marginRight: 'auto' },
        right: { marginLeft: 'auto' },
      }[alignment] || { marginLeft: 'auto', marginRight: 'auto' }
    const single = items[0]
    const img = (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={single.src}
        alt={single.alt || ''}
        style={{
          display: 'block',
          maxWidth: '100%',
          width: config.width,
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
        {single.linkUrl ? (
          <a
            href={resolveFunnelUrl(single.linkUrl)}
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

  // Mode galerie : grid auto-fit responsive avec un nombre de colonnes
  // maximum imposé par `columns` et une taille maximale par image via `size`.
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            items.length === 1
              ? '1fr'
              : `repeat(auto-fit, minmax(min(100%, ${
                  maxItemWidth ? `${Math.min(maxItemWidth, 320)}px` : '260px'
                }), 1fr))`,
          maxWidth:
            maxItemWidth != null ? maxItemWidth * Math.min(columns, items.length) + 24 * (columns - 1) : undefined,
          gap: 24,
          marginLeft: 'auto',
          marginRight: 'auto',
          justifyItems: justifyContent === 'flex-start' ? 'start' : justifyContent === 'flex-end' ? 'end' : 'center',
        }}
      >
        {items.map((item, i) => (
          <div key={i} style={{ width: '100%', maxWidth: maxItemWidth ?? undefined }}>
            {renderImage(item, maxItemWidth)}
          </div>
        ))}
      </div>
    </div>
  )
}
