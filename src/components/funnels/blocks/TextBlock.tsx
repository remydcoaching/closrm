'use client'

/**
 * T-028c — TextBlock migré vers le design system v2.
 *
 * Bloc de texte libre. Utilise les CSS vars du design system (`--fnl-text`)
 * pour la couleur et `Poppins` pour la typo (héritée de `.fnl-root`).
 *
 * Avant : couleur `#333` codée en dur, pas de classe partagée.
 * Après : `color: var(--fnl-text)` qui s'adapte automatiquement au preset
 * (light → #2D2D2D, dark → #FFFFFF).
 *
 * Préserve le rendu multi-lignes : chaque `\n` du content devient un `<br>`.
 */

import type { FunnelTextBlockConfig } from '@/types'

interface Props {
  config: FunnelTextBlockConfig
}

export default function TextBlock({ config }: Props) {
  const lines = (config.content || '').split('\n')

  return (
    <div
      style={{
        padding: '24px 20px',
        maxWidth: 720,
        margin: '0 auto',
        fontSize: 16,
        lineHeight: 1.6,
        color: 'var(--fnl-text)',
        textAlign: config.alignment || 'left',
      }}
    >
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  )
}
