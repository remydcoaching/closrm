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
  const content = config.content || ''
  const isHtml = /<[a-z][\s\S]*>/i.test(content)

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
      {isHtml ? (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        content.split('\n').map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))
      )}
    </div>
  )
}
