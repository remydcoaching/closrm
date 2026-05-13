import React from 'react'
import { View, Text } from 'react-native'
import type { LeadSource } from '@shared/types'
import { sourceConfig } from '../../theme/status'
import { type } from '../../theme/tokens'

interface SourceBadgeProps {
  source: LeadSource
  size?: 'sm' | 'md'
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = sourceConfig[source]
  const py = size === 'sm' ? 2 : 4
  const px = size === 'sm' ? 7 : 10
  return (
    <View
      style={{
        backgroundColor: config.color + '26',
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: 999,
      }}
    >
      <Text style={{ ...type.caption2, color: config.color, fontWeight: '600' }}>
        {config.label}
      </Text>
    </View>
  )
}
