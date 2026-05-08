import React from 'react'
import { View, Text } from 'react-native'
import type { LeadStatus } from '@shared/types'
import { statusConfig } from '../../theme/status'

interface StatusBadgeProps {
  status: LeadStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status]
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
        // Border subtile même couleur pour donner un feel 'glass pill'
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
