'use client'

/**
 * T-028c — TestimonialsBlock migré vers le design system v2.
 *
 * Grille de cards de témoignages clients. Adopte le langage visuel :
 * - cards avec border-radius 20px, ombre colorée via `--fnl-primary-rgb`
 * - hover translateY -5px + ombre amplifiée (cohérent avec sandbox T-028a)
 * - étoiles en `--fnl-primary` au lieu du `#f5a623` hardcodé (l'orange ne
 *   matche pas tous les presets, le primary du preset est plus cohérent)
 * - avatar fallback (initiales) avec gradient `--fnl-primary` → `--fnl-primary-light`
 * - typo Poppins partout (héritée de `.fnl-root`)
 *
 * Note : la lightbox E6 (forcée) n'est pas branchée ici en V1 — les images
 * d'avatars sont petites (40px), pas vraiment pertinent d'ouvrir en grand.
 * Si on veut afficher des screenshots/résultats clients en grand, on créera
 * un nouveau bloc dédié "ResultsGallery" en V2 (cf. ameliorations.md A-028a-04).
 *
 * Layout : grid auto-fit minmax(280px, 1fr) → responsive natif sans media query.
 */

import type { TestimonialsBlockConfig, TestimonialItem } from '@/types'

interface Props {
  config: TestimonialsBlockConfig
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color:
              i <= rating
                ? 'var(--fnl-primary)'
                : 'rgba(var(--fnl-primary-rgb), 0.2)',
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span style={{ position: 'absolute', left: -9999 }}>{rating}/5</span>
    </div>
  )
}

function BeforeAfter({ before, after }: { before: string; after: string }) {
  // Grille 50/50 avec ratio 4/5 portrait par défaut pour matcher les photos
  // de transformation physique (cas d'usage principal des coachs sport).
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        margin: '0 0 18px',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {[
        { src: before, label: 'AVANT' },
        { src: after, label: 'APRÈS' },
      ].map((side, i) => (
        <div key={i} style={{ position: 'relative', aspectRatio: '4 / 5', background: 'rgba(var(--fnl-primary-rgb), 0.05)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={side.src}
            alt={side.label}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
            }}
          >
            {side.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  const hasBefore = !!item.beforeImageUrl
  const hasAfter = !!item.afterImageUrl
  return (
    <div
      style={{
        background: 'var(--fnl-section-bg)',
        borderRadius: 20,
        padding: 28,
        boxShadow:
          '0 8px 30px rgba(var(--fnl-primary-rgb), 0.12), 0 2px 10px rgba(0, 0, 0, 0.05)',
        border: '1px solid rgba(var(--fnl-primary-rgb), 0.1)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        position: 'relative',
      }}
    >
      {hasBefore && hasAfter && (
        <BeforeAfter before={item.beforeImageUrl!} after={item.afterImageUrl!} />
      )}
      <Stars rating={item.rating} />
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--fnl-text)',
          margin: '0 0 20px',
          fontStyle: 'italic',
        }}
      >
        &ldquo;{item.content}&rdquo;
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {item.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.avatarUrl}
            alt={item.name}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid rgba(var(--fnl-primary-rgb), 0.2)',
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 4px 12px rgba(var(--fnl-primary-rgb), 0.3)',
            }}
            aria-hidden="true"
          >
            {getInitials(item.name)}
          </div>
        )}
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--fnl-text)',
            }}
          >
            {item.name}
          </div>
          {item.role && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--fnl-text-secondary)',
                fontStyle: 'italic',
                marginTop: 2,
              }}
            >
              {item.role}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsBlock({ config }: Props) {
  if (!config.items || config.items.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--fnl-text-secondary)',
          fontSize: 14,
        }}
      >
        Aucun témoignage configuré
      </div>
    )
  }

  return (
    <div style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}
      >
        {config.items.map((item, i) => (
          <TestimonialCard key={i} item={item} />
        ))}
      </div>
    </div>
  )
}
