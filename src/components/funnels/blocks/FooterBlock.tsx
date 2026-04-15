'use client'

/**
 * T-028 Phase 10 — FooterBlock.
 *
 * Bloc Footer simple : nom de la marque en gros + année de copyright + texte
 * copyright custom. Utilise la classe `.fnl-footer` du design system qui
 * applique le fond `--fnl-footer-bg` du preset + padding + centrage.
 *
 * Ce bloc est créé automatiquement dans toute nouvelle page d'un funnel
 * (cf. getDefaultPageBlocks dans src/lib/funnels/defaults.ts) pour que le
 * coach ait un squelette de page prêt à éditer au lieu d'une page vide.
 * Le coach peut le supprimer s'il veut.
 */

import type { FunnelFooterBlockConfig } from '@/types'

interface Props {
  config: FunnelFooterBlockConfig
}

export default function FooterBlock({ config }: Props) {
  const year = config.year || new Date().getFullYear()

  return (
    <footer className="fnl-footer">
      {config.brand && (
        <p
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--fnl-primary)',
            margin: '0 0 10px',
            fontFamily: 'Poppins, sans-serif',
            letterSpacing: 0.5,
          }}
        >
          {config.brand}™
        </p>
      )}
      <p
        style={{
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          margin: 0,
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        © {year} {config.brand || 'Ma marque'}.{' '}
        {config.copyrightText || 'Tous droits réservés.'}
      </p>
    </footer>
  )
}
