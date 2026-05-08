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
  const py = size === 'sm' ? 3 : 5
  const px = size === 'sm' ? 9 : 13
  const fontSize = size === 'sm' ? 11 : 13

  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: config.color + '33',
      }}
    >
      <Text
        style={{
          color: config.color,
          fontSize,
          fontWeight: '700',
          letterSpacing: 0.2,
        }}
      >
        {config.label}
      </Text>
    </View>
  )
}
