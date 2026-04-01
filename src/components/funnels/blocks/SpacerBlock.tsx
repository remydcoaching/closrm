'use client'

import type { SpacerBlockConfig } from '@/types'

interface Props {
  config: SpacerBlockConfig
}

export default function SpacerBlock({ config }: Props) {
  return <div style={{ height: config.height || 40 }} />
}
