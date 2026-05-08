import React from 'react'
import { View, Text } from 'react-native'
import type { LeadSource } from '@shared/types'
import { sourceConfig } from '../../theme/status'

interface SourceBadgeProps {
  source: LeadSource
  size?: 'sm' | 'md'
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = sourceConfig[source]
  const py = size === 'sm' ? 2 : 4
  const px = size === 'sm' ? 8 : 12
  const fontSize = size === 'sm' ? 11 : 13

  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: config.color, fontSize, fontWeight: '600' }}>{config.label}</Text>
    </View>
  )
}
