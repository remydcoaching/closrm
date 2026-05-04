'use client'

import { INTENT_META, type SocialIntent } from '@/lib/social/intent-classifier'

export default function IntentBadge({ intent, size = 'sm' }: { intent: SocialIntent; size?: 'sm' | 'xs' }) {
  const m = INTENT_META[intent]
  const fontSize = size === 'xs' ? 9 : 10
  const padding = size === 'xs' ? '2px 6px' : '3px 8px'
  return (
    <span
      title={m.description}
      style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
        padding,
        color: m.color,
        background: `${m.color}1a`,
        border: `1px solid ${m.color}40`,
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  )
}
